package app

import (
	"bufio"
	"encoding/json"
	"strings"
	"sync"
	"time"

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
		err = fiber.NewError(fiber.StatusInternalServerError, "failed to query database for firewall log entries")
		return
	}

	err = c.JSON(entries)
	return
}

func apiGetLogsByAge(c *fiber.Ctx) (err error) {
	var ageSeconds int = c.QueryInt("ageSeconds", 3600)
	if ageSeconds < 1 {
		ageSeconds = 1
	} else if ageSeconds > 365*24*3600 {
		ageSeconds = 365 * 24 * 3600
	}

	var (
		cutoffTimestamp time.Time = time.Now().Add(-time.Duration(ageSeconds) * time.Second)
		entries         []*db.FirewallLogEntry
	)

	if entries, err = db.FirewallLogEntries.SelectAllWithFilter(gomysql.NewFilter().KeyCmp(db.FirewallLogEntries.FieldBySQLName("timestamp"), gomysql.OpGreaterThanOrEqual, cutoffTimestamp).Ordering(&db.FirewallLogEntries.PrimaryKeyField, false)); err != nil {
		err = fiber.NewError(fiber.StatusInternalServerError, "failed to query database for firewall log entries")
		return
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

			if _, err = w.WriteString("data: " + string(jsonData) + "\n\n"); err != nil && !strings.Contains(err.Error(), "connection closed") {
				appLog.Errorf("failed to write to log stream: %v\n", err)
				return
			}

			if err = w.Flush(); err != nil && !strings.Contains(err.Error(), "connection closed") {
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

func apiPostGeolocationMany(c *fiber.Ctx) (err error) {
	// Body expects a text/plain content with comma-separated IP addresses, e.g.:
	// 10.0.0.1,10.0.0.2,fd00:dead:beef::1,...

	var (
		bodyBytes  []byte          = c.Body()
		ips        []string        = strings.Split(strings.TrimSpace(string(bodyBytes)), ",")
		results    []*geoip.IPInfo = make([]*geoip.IPInfo, 0, len(ips))
		bucketSize int             = 100
		numBuckets int             = (len(ips) + bucketSize - 1) / bucketSize
		wg         sync.WaitGroup
	)

	for i := range numBuckets {
		var bucketIPs []string = ips[i*bucketSize : min((i+1)*bucketSize, len(ips))]
		wg.Go(func() {
			for _, ip := range bucketIPs {
				ip = strings.TrimSpace(ip)
				if ip == "" {
					continue
				}

				var info *geoip.IPInfo
				if info, err = geoip.GetIPInfo(ip); err != nil {
					appLog.Errorf("failed to geolocate IP address '%s': %v\n", ip, err)
					continue
				}

				results = append(results, info)
			}
		})
	}

	wg.Wait()
	err = c.JSON(results)
	return
}
