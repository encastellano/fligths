#Extract geojson from shapefile with states

ogr2ogr -f GeoJSON -where "iso_a2 = 'US' and name <> 'Alaska' and name <> 'Hawaii'" states_land.json ne_10m_admin_1_states_provinces.shp
topojson --id-property code_hasc -p name=NAME -p name -o us_states.topo.json us_states.geo.json

geo2topo us_states.geo.json > states.topo.json


ogr2ogr -f GeoJSON  airports.json ne_10m_airports.shp