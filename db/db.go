package db

import (
	"fmt"
	"os"
	"slices"

	"github.com/UNHCSC/opnsense-firewall-display/config"
	"github.com/z46-dev/golog"
	"github.com/z46-dev/gomysql"
)

var (
	dbLog              *golog.Logger
	FirewallLogEntries *gomysql.RegisteredStruct[FirewallLogEntry]
)

func Init(parentLog *golog.Logger) (err error) {
	dbLog = parentLog.SpawnChild().Prefix("[DB]", golog.BoldGreen)

	if err = gomysql.Begin(config.Config.Database.File); err != nil {
		dbLog.Errorf("Failed to initialize database: %v\n", err)
		return
	}

	if FirewallLogEntries, err = gomysql.Register(FirewallLogEntry{}); err != nil {
		dbLog.Errorf("Failed to register Group struct: %v\n", err)
		return
	}

	// Migrations
	var migrationOpts gomysql.MigrationOptions

	if len(os.Args) > 1 && slices.Contains(os.Args, "--allow-destructive-migrations") {
		migrationOpts.AllowDestructive = true
		dbLog.Warning("Destructive migrations are enabled!")
	}

	if err = migrate(FirewallLogEntries, migrationOpts); err != nil {
		dbLog.Errorf("Failed to migrate Groups table: %v\n", err)
		return
	}

	dbLog.Info("Database initialized successfully")

	return
}

func migrate[T any](table *gomysql.RegisteredStruct[T], opts gomysql.MigrationOptions) (err error) {
	var report *gomysql.MigrationReport

	if report, err = table.Migrate(opts); err != nil {
		return
	}

	if report == nil {
		err = fmt.Errorf("migration report is nil")
		return
	}

	if len(report.AddedColumns) > 0 {
		dbLog.Warningf("Added columns to table for %T: %v\n", *new(T), report.AddedColumns)
	}

	if len(report.ChangedColumns) > 0 {
		dbLog.Warningf("Changed columns in table for %T: %v\n", *new(T), report.ChangedColumns)
	}

	if len(report.DroppedColumns) > 0 {
		dbLog.Warningf("Dropped columns from table for %T: %v\n", *new(T), report.DroppedColumns)
	}

	if len(report.RenamedColumns) > 0 {
		dbLog.Warningf("Renamed columns in table for %T: %v\n", *new(T), report.RenamedColumns)
	}

	if report.Rebuilt {
		dbLog.Warningf("Rebuilt table for %T\n", *new(T))
	}

	return
}
