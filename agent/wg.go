package main

import (
	"fmt"
	"net"

	"golang.zx2c4.com/wireguard/wgctrl"
	"golang.zx2c4.com/wireguard/wgctrl/wgtypes"
)

// wgManager is the entire privileged surface of this agent: add a peer, remove a peer, read
// state. There is deliberately no path that runs a command, writes a config file, or touches
// anything but the one WireGuard interface (SPEC §7).
type wgManager struct {
	client *wgctrl.Client
	iface  string
}

func newWgManager(iface string) (*wgManager, error) {
	client, err := wgctrl.New()
	if err != nil {
		return nil, fmt.Errorf("open wireguard control socket: %w", err)
	}
	return &wgManager{client: client, iface: iface}, nil
}

func (m *wgManager) close() error { return m.client.Close() }

func (m *wgManager) device() (*wgtypes.Device, error) {
	return m.client.Device(m.iface)
}

// addPeer is idempotent: configuring a public key that is already present replaces its allowed
// IPs rather than failing, which is what SPEC §7 requires of a retried call.
func (m *wgManager) addPeer(pubkey wgtypes.Key, allowed net.IPNet) error {
	return m.client.ConfigureDevice(m.iface, wgtypes.Config{
		Peers: []wgtypes.PeerConfig{{
			PublicKey:         pubkey,
			ReplaceAllowedIPs: true,
			AllowedIPs:        []net.IPNet{allowed},
		}},
	})
}

// removePeer is idempotent: the kernel treats removal of an absent peer as a no-op, so a retried
// revoke succeeds instead of leaving the control plane unable to finish (SPEC §7).
func (m *wgManager) removePeer(pubkey wgtypes.Key) error {
	return m.client.ConfigureDevice(m.iface, wgtypes.Config{
		Peers: []wgtypes.PeerConfig{{PublicKey: pubkey, Remove: true}},
	})
}
