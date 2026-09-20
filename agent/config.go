package main

import (
	"fmt"
	"os"
)

type config struct {
	token      string
	iface      string
	listenAddr string
	tlsCert    string
	tlsKey     string
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func loadConfig() (config, error) {
	c := config{
		token:      os.Getenv("AGENT_TOKEN"),
		iface:      envOr("WG_INTERFACE", "wg0"),
		listenAddr: envOr("LISTEN_ADDR", ":51821"),
		tlsCert:    os.Getenv("TLS_CERT_FILE"),
		tlsKey:     os.Getenv("TLS_KEY_FILE"),
	}

	if c.token == "" {
		return config{}, fmt.Errorf("AGENT_TOKEN is required")
	}
	if (c.tlsCert == "") != (c.tlsKey == "") {
		return config{}, fmt.Errorf("TLS_CERT_FILE and TLS_KEY_FILE must be set together")
	}
	return c, nil
}
