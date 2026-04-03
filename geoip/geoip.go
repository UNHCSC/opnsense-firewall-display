package geoip

import (
	"net"

	"github.com/oschwald/geoip2-golang"
	"github.com/z46-dev/golog"
)

var (
	databaseASNs, databaseCities, databaseCountries *geoip2.Reader
	logger                                          *golog.Logger
)

func InitGeoIPDB(path string) (database *geoip2.Reader, err error) {
	database, err = geoip2.Open(path)
	return
}

func Init(parentInstance *golog.Logger, asnDBPath, cityDBPath, countryDBPath string) (err error) {
	logger = parentInstance.SpawnChild().Prefix("[GEOIP]", golog.BoldYellow)

	if databaseASNs, err = InitGeoIPDB(asnDBPath); err != nil {
		logger.Errorf("Error initializing ASN database: %v", err)
		return
	}

	if databaseCities, err = InitGeoIPDB(cityDBPath); err != nil {
		logger.Errorf("Error initializing City database: %v", err)
		return
	}

	if databaseCountries, err = InitGeoIPDB(countryDBPath); err != nil {
		logger.Errorf("Error initializing Country database: %v", err)
		return
	}

	return
}

func CloseAll() (err error) {
	if databaseASNs != nil {
		if err = databaseASNs.Close(); err != nil {
			logger.Errorf("Error closing ASN database: %v", err)
		}
	}

	if databaseCities != nil {
		if err = databaseCities.Close(); err != nil {
			logger.Errorf("Error closing City database: %v", err)
		}
	}

	if databaseCountries != nil {
		if err = databaseCountries.Close(); err != nil {
			logger.Errorf("Error closing Country database: %v", err)
		}
	}

	return
}

func GetIPInfo(ip string) (info *IPInfo, err error) {
	var (
		netIP         net.IP = net.ParseIP(ip)
		asnRecord     *geoip2.ASN
		cityRecord    *geoip2.City
		countryRecord *geoip2.Country
	)

	if netIP == nil {
		err = net.InvalidAddrError("invalid IP address")
		return
	}

	if databaseASNs != nil {
		if asnRecord, err = databaseASNs.ASN(netIP); err != nil {
			logger.Errorf("Error looking up ASN for IP %s: %v", ip, err)
			return
		}
	}

	if databaseCities != nil {
		if cityRecord, err = databaseCities.City(netIP); err != nil {
			logger.Errorf("Error looking up City for IP %s: %v", ip, err)
			return
		}
	}

	if databaseCountries != nil {
		if countryRecord, err = databaseCountries.Country(netIP); err != nil {
			logger.Errorf("Error looking up Country for IP %s: %v", ip, err)
			return
		}
	}

	info = &IPInfo{Address: ip}

	if asnRecord != nil {
		info.ASN = IPInfoASN{
			ASN:          asnRecord.AutonomousSystemNumber,
			Organization: asnRecord.AutonomousSystemOrganization,
		}
	}

	if cityRecord != nil {
		info.City = IPInfoCity{
			CountryISOCode: cityRecord.Country.IsoCode,
			CityName:       cityRecord.City.Names["en"],
			Latitude:       cityRecord.Location.Latitude,
			Longitude:      cityRecord.Location.Longitude,
		}
	}

	if countryRecord != nil {
		info.Country = IPInfoCountry{
			CountryName:    countryRecord.Country.Names["en"],
			CountryISOCode: countryRecord.Country.IsoCode,
		}
	}

	return
}
