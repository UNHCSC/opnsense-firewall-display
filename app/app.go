package app

import (
	"github.com/UNHCSC/opnsense-firewall-display/config"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/template/html/v2"
	"github.com/z46-dev/golog"
)

var appLog *golog.Logger = golog.New().Prefix("[Please call app.InitAndListen() with the main logger]", golog.BoldRed)

func InitAndListen(parentLog *golog.Logger) (app *fiber.App, err error) {
	appLog = parentLog.SpawnChild().Prefix("[APP]", golog.BoldPurple)

	var templateEngine *html.Engine = html.New("./client/views", ".html")
	templateEngine.Reload(config.Config.WebServer.ReloadTemplatesOnEachRender)

	app = fiber.New(fiber.Config{
		Views:   templateEngine,
		Network: "tcp",
	})

	// Statics
	app.Static("/static", "./client/static")

	// Pages
	app.Get("/", getIndex)

	// API
	var (
		api   fiber.Router = app.Group("/api")
		apiV1 fiber.Router = api.Group("/v1")
	)

	// API v1
	var (
		apiV1History fiber.Router = apiV1.Group("/history")
	)

	// API v1 auth
	apiV1History.Get("/headers", _noop)
	apiV1History.Get("/logs", _noop)

	return
}

func _noop(*fiber.Ctx) (err error) {
	return
}
