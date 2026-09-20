package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := loadConfig()
	if err != nil {
		log.Error("invalid configuration", "err", err)
		os.Exit(1)
	}

	wg, err := newWgManager(cfg.iface)
	if err != nil {
		log.Error("cannot reach wireguard", "iface", cfg.iface, "err", err)
		os.Exit(1)
	}
	defer func() { _ = wg.close() }()

	// Fail at startup rather than on the first revoke: a missing interface or absent NET_ADMIN
	// should be visible when the node is onboarded, not when a kill switch is pulled.
	if _, err := wg.device(); err != nil {
		log.Error("wireguard interface unavailable", "iface", cfg.iface, "err", err)
		os.Exit(1)
	}

	srv := &http.Server{
		Addr:              cfg.listenAddr,
		Handler:           (&server{cfg: cfg, wg: wg, log: log}).routes(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-shutdown
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(ctx)
	}()

	tls := cfg.tlsCert != ""
	log.Info("agent listening", "addr", cfg.listenAddr, "iface", cfg.iface, "tls", tls)

	if tls {
		err = srv.ListenAndServeTLS(cfg.tlsCert, cfg.tlsKey)
	} else {
		err = srv.ListenAndServe()
	}
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Error("server stopped", "err", err)
		os.Exit(1)
	}
}
