package app

import (
	"bufio"
	"encoding/json"

	"github.com/UNHCSC/opnsense-firewall-display/db"
	"github.com/UNHCSC/opnsense-firewall-display/geoip"
	"github.com/UNHCSC/opnsense-firewall-display/listener"
	"github.com/gofiber/fiber/v2"
	"github.com/z46-dev/gomysql"
)

func apiGetLogs(c *fiber.Ctx) (err error) {
	var limit int = c.QueryInt("limit", 100)
	if limit < 1 {
		limit = 1
	} else if limit > 10000 {
		limit = 10000
	}

	var entries []*db.FirewallLogEntry
	if entries, err = db.FirewallLogEntries.SelectAllWithFilter(gomysql.NewFilter().Ordering(&db.FirewallLogEntries.PrimaryKeyField, false).Limit(limit)); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to query database for firewall log entries")
	}

	err = c.JSON(entries)
	return
}

func apiGetLogStream(c *fiber.Ctx) (err error) {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-store")
	c.Set("Connection", "keep-alive")

	var sub listener.Subscriber = listener.Subscribe()

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer listener.Unsubscribe(sub)

		for entry := range sub {
			var jsonData []byte
			if jsonData, err = json.Marshal(entry); err != nil {
				appLog.Errorf("failed to serialize firewall log entry to JSON: %v\n", err)
				continue
			}

			if _, err = w.WriteString("data: " + string(jsonData) + "\n\n"); err != nil {
				appLog.Errorf("failed to write to log stream: %v\n", err)
				return
			}

			if err = w.Flush(); err != nil {
				appLog.Errorf("failed to flush log stream: %v\n", err)
				return
			}
		}
	})

	return
}

func apiGetGeolocation(c *fiber.Ctx) (err error) {
	var ip string = c.Query("ip", "")
	if ip == "" {
		err = fiber.NewError(fiber.StatusBadRequest, "missing required query parameter: ip")
		return
	}

	var result *geoip.IPInfo
	if result, err = geoip.GetIPInfo(ip); err != nil {
		err = fiber.NewError(fiber.StatusInternalServerError, "failed to geolocate IP address")
		return
	}

	err = c.JSON(result)
	return
}
