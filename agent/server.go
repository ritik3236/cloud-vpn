package main

import (
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strings"

	"golang.zx2c4.com/wireguard/wgctrl/wgtypes"
)

const maxBodyBytes = 4 << 10

type server struct {
	cfg config
	wg  *wgManager
	log *slog.Logger
}

// Wire shapes below are a contract with the control plane's zod schemas
// (src/api/endpoints/agent.ts). Changing a field name here fails validation there on purpose —
// silent drift on a revoke call would be a security bug, not a cosmetic one.

type okResponse struct {
	OK bool `json:"ok"`
}

type addPeerRequest struct {
	Pubkey    string `json:"pubkey"`
	AllowedIP string `json:"allowed_ip"`
}

type peerView struct {
	Pubkey        string `json:"pubkey"`
	AllowedIP     string `json:"allowed_ip"`
	LastHandshake *int64 `json:"last_handshake"`
	RxBytes       int64  `json:"rx_bytes"`
	TxBytes       int64  `json:"tx_bytes"`
}

type peersResponse struct {
	Peers []peerView `json:"peers"`
}

type healthResponse struct {
	Status     string `json:"status"`
	NodePubkey string `json:"node_pubkey"`
	WgUp       bool   `json:"wg_up"`
	// Reported, not enforced. The agent states facts about the host; the control plane decides
	// whether they disqualify the node (SPEC §10). Null means the value could not be read.
	IPForward    *bool `json:"ip_forward"`
	SrcValidMark *bool `json:"src_valid_mark"`
}

func (s *server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /peers", s.authorize(s.handleAddPeer))
	mux.HandleFunc("DELETE /peers/{pubkey}", s.authorize(s.handleRemovePeer))
	mux.HandleFunc("GET /peers", s.authorize(s.handleListPeers))
	// /health is authenticated too: it reveals the node's public key and interface state, and
	// the control plane is the only legitimate caller anyway.
	mux.HandleFunc("GET /health", s.authorize(s.handleHealth))
	return mux
}

func (s *server) authorize(next http.HandlerFunc) http.HandlerFunc {
	const prefix = "Bearer "
	want := []byte(s.cfg.token)

	return func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, prefix) {
			writeError(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		got := []byte(strings.TrimPrefix(header, prefix))
		if subtle.ConstantTimeCompare(got, want) != 1 {
			writeError(w, http.StatusUnauthorized, "invalid bearer token")
			return
		}
		next(w, r)
	}
}

func (s *server) handleAddPeer(w http.ResponseWriter, r *http.Request) {
	var req addPeerRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "malformed json body")
		return
	}

	key, err := parseKey(req.Pubkey)
	if err != nil {
		writeError(w, http.StatusBadRequest, "pubkey is not a valid WireGuard key")
		return
	}
	address, network, err := net.ParseCIDR(req.AllowedIP)
	if err != nil {
		writeError(w, http.StatusBadRequest, "allowed_ip is not valid CIDR")
		return
	}

	// Keep the host address, not the network address ParseCIDR returns, so 10.8.0.2/32 routes
	// to that peer rather than to 10.8.0.0.
	if err := s.wg.addPeer(key, net.IPNet{IP: address, Mask: network.Mask}); err != nil {
		s.log.Error("add peer failed", "err", err)
		writeError(w, http.StatusInternalServerError, "could not configure peer")
		return
	}

	s.log.Info("peer added", "pubkey", req.Pubkey, "allowed_ip", req.AllowedIP)
	writeJSON(w, http.StatusOK, okResponse{OK: true})
}

func (s *server) handleRemovePeer(w http.ResponseWriter, r *http.Request) {
	key, err := parseKey(r.PathValue("pubkey"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "pubkey is not a valid WireGuard key")
		return
	}

	if err := s.wg.removePeer(key); err != nil {
		s.log.Error("remove peer failed", "err", err)
		writeError(w, http.StatusInternalServerError, "could not remove peer")
		return
	}

	s.log.Info("peer removed", "pubkey", key.String())
	writeJSON(w, http.StatusOK, okResponse{OK: true})
}

func (s *server) handleListPeers(w http.ResponseWriter, r *http.Request) {
	device, err := s.wg.device()
	if err != nil {
		s.log.Error("read device failed", "err", err)
		writeError(w, http.StatusInternalServerError, "could not read wireguard device")
		return
	}

	peers := make([]peerView, 0, len(device.Peers))
	for _, p := range device.Peers {
		view := peerView{
			Pubkey:  p.PublicKey.String(),
			RxBytes: p.ReceiveBytes,
			TxBytes: p.TransmitBytes,
		}
		// The control plane assigns exactly one address per peer (SPEC §5).
		if len(p.AllowedIPs) > 0 {
			view.AllowedIP = p.AllowedIPs[0].String()
		}
		// A zero time means the peer has never completed a handshake — report null rather than
		// a 1970 timestamp, which would read as "connected long ago".
		if !p.LastHandshakeTime.IsZero() {
			seconds := p.LastHandshakeTime.Unix()
			view.LastHandshake = &seconds
		}
		peers = append(peers, view)
	}

	writeJSON(w, http.StatusOK, peersResponse{Peers: peers})
}

func (s *server) handleHealth(w http.ResponseWriter, r *http.Request) {
	device, err := s.wg.device()
	if err != nil {
		s.log.Error("health check failed", "err", err)
		writeJSON(w, http.StatusOK, healthResponse{Status: "degraded"})
		return
	}

	writeJSON(w, http.StatusOK, healthResponse{
		Status:       "ok",
		NodePubkey:   device.PublicKey.String(),
		WgUp:         device.ListenPort != 0,
		IPForward:    readSysctlFlag("/proc/sys/net/ipv4/ip_forward"),
		SrcValidMark: readSysctlFlag("/proc/sys/net/ipv4/conf/all/src_valid_mark"),
	})
}

// readSysctlFlag reads a 0/1 sysctl directly from /proc rather than shelling out to sysctl.
// These two are the LXC trap in SPEC §12: a container can look healthy, accept peers, and still
// forward nothing, so onboarding checks them rather than discovering it from a user report.
func readSysctlFlag(path string) *bool {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	value := strings.TrimSpace(string(raw)) == "1"
	return &value
}

// parseKey accepts a WireGuard key as standard base64 (as sent in a JSON body) or base64url
// (as sent in a path segment, where '/' and '+' would otherwise depend on how the router
// handles percent-encoding).
func parseKey(raw string) (wgtypes.Key, error) {
	if key, err := wgtypes.ParseKey(raw); err == nil {
		return key, nil
	}
	decoded, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(raw, "="))
	if err != nil {
		return wgtypes.Key{}, err
	}
	return wgtypes.NewKey(decoded)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
