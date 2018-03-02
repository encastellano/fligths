var isRunning = true;

$(function () {
 

  // Various formatters.
  var formatDate = d3.time.format("%Y-%m-%d");


  var currentWidth = $('#map').width();
  var width = 960;
  var height = 780;

  var relationSize = width / height;

  var projection = d3.geo
    .albers();

  var fligthsById = d3.map(),
    datesById = d3.map();


  var path = d3.geo
    .path()
    .pointRadius(2)
    .projection(projection);


  var svg = d3.select("#map")
    .append("svg")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("width", width)
    .attr("height", height);


  var airportMap = {};

  var extant = [];
  var flights = crossfilter(),
    all = flights.groupAll(),
    flight_date = flights.dimension(function (d) {
       return formatDate.parse(d.properties.date); 
      }),
    flight_dates = flight_date.group();

  var parseFligths = function (d) {
    var features = d.features;
    for (var index in features) {
      var feat = features[index];
      var properties = feat.properties;

      flights.add([feat]);
      extant.push(properties.id);

      fligthsById.set(properties.id, properties.company);
      datesById.set(properties.id, properties.date);


    }

  }
  queue()
    .defer(d3.json, "json/flights.geo.json")
    .defer(d3.json, "json/states_land.topo.json")
    .defer(d3.json, "json/airports2.topo.json")
    .defer(d3.json, "json/us_airports.topojson")
    .awaitAll(loaded);


  function loaded(error, results) {

    var fligthsJson = results[0];
    var statesJson = results[1];
    var airportsJson = results[2];
    var usairportsJson = results[3];
    
    parseFligths(fligthsJson);


    svg.append("g")
      .attr("class", "countries")
      .selectAll("path")
      .data(topojson.feature(statesJson, statesJson.objects.states_land).features)
      .enter()
      .append("path")
      .attr("d", path);

    svg.append("g")
      .attr("class", "airports")
      .selectAll("path")
      .data(topojson.feature(airportsJson, airportsJson.objects.airports).features)
      .enter()
      .append("path")
      .attr("id", function (d) { return d.id; })
      .attr("d", path);

    var charts = [

      barChart(false)
        .dimension(flight_date)
        .group(flight_dates)
        .x(d3.time.scale()
          .domain([formatDate.parse('2017-01-01'),formatDate.parse('2017-12-31') ])
          .range([50, currentWidth-50]))
          
          // .rangeRound([0, 10 * 365]))
        //.filter([new Date(2017, 1, 1), new Date(2017, 2, 1)])

    ];

    var chart = d3.selectAll(".chart")
      .data(charts)
      .each(function (chart) { chart.on("brush", renderAll).on("brushend", renderAll); });


    var geos = topojson.feature(airportsJson, airportsJson.objects.airports).features;

    
    for (i in geos) {
      airportMap[geos[i].id] = geos[i].geometry.coordinates;
    }
    renderAll();

    //launchMockAnimation();

    launchPlannedAnimation(fligthsJson.features);
    // barChart
    function barChart(percent) {
      if (!barChart.id) barChart.id = 0;

      percent = typeof percent !== 'undefined' ? percent : false;
      var formatAsPercentage = d3.format(".0%");

      var axis = d3.svg.axis().orient("bottom");
      if (percent == true) {
        axis.tickFormat(formatAsPercentage);

      }
      var margin = { top: 10, right: 10, bottom: 20, left: 10 },
        x,
        y = d3.scale.linear().range([50, 0]),
        id = barChart.id++,
        brush = d3.svg.brush(),
        brushDirty,
        dimension,
        group,
        round;

      function chart(div) {
        var width = x.range()[1],
          height = y.range()[0];

        try {
          y.domain([0, group.top(1)[0].value]);
        }
        catch (err) {
          window.reset
        }

        div.each(function () {
          var div = d3.select(this),
            g = div.select("g");

          // Create the skeletal chart.
          if (g.empty()) {
            div.select(".title").append("a")
              .attr("href", "javascript:reset(" + id + ")")
              .attr("class", "reset")
              .text("reset")
              .style("display", "none");

            g = div.append("svg")
              .attr("width", width + margin.left + margin.right)
              .attr("height", height + margin.top + margin.bottom)
              .append("g")
              .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            g.append("clipPath")
              .attr("id", "clip-" + id)
              .append("rect")
              .attr("width", width)
              .attr("height", height);

            g.selectAll(".bar")
              .data(["background", "foreground"])
              .enter().append("path")
              .attr("class", function (d) {
                 return d + " bar"; 
                })
              .datum(group.all());

            g.selectAll(".foreground.bar")
              .attr("clip-path", "url(#clip-" + id + ")");

            g.append("g")
              .attr("class", "axis")
              .attr("transform", "translate(0," + height + ")")
              .call(axis);

            // Initialize the brush component with pretty resize handles.
            var gBrush = g.append("g").attr("class", "brush").call(brush);
            gBrush.selectAll("rect").attr("height", height);
            gBrush.selectAll(".resize").append("path").attr("d", resizePath);
          }

          // Only redraw the brush if set externally.
          if (brushDirty) {
            brushDirty = false;
            g.selectAll(".brush").call(brush);
            div.select(".title a").style("display", brush.empty() ? "none" : null);
            if (brush.empty()) {
              g.selectAll("#clip-" + id + " rect")
                .attr("x", 0)
                .attr("width", width);
            } else {
              var extent = brush.extent();
              g.selectAll("#clip-" + id + " rect")
                .attr("x", x(extent[0]))
                .attr("width", x(extent[1]) - x(extent[0]));
            }
          }

          g.selectAll(".bar").attr("d", barPath);
        });

        function barPath(groups) {
          var path = [],
            i = -1,
            n = groups.length,
            d;
          while (++i < n) {
            d = groups[i];
            xAxys= x(d.key);
            path.push("M", xAxys, ",", height, "V", y(d.value), "h9V", height);
          }
          return path.join("");
        }

        function resizePath(d) {
          var e = +(d == "e"),
            x = e ? 1 : -1,
            y = height / 3;
          return "M" + (.5 * x) + "," + y
            + "A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6)
            + "V" + (2 * y - 6)
            + "A6,6 0 0 " + e + " " + (.5 * x) + "," + (2 * y)
            + "Z"
            + "M" + (2.5 * x) + "," + (y + 8)
            + "V" + (2 * y - 8)
            + "M" + (4.5 * x) + "," + (y + 8)
            + "V" + (2 * y - 8);
        }
      }

      brush.on("brushstart.chart", function () {
        var div = d3.select(this.parentNode.parentNode.parentNode);
        div.select(".title a").style("display", null);
      });

      brush.on("brush.chart", function () {
        // var g = d3.select(this.parentNode),
        //   extent = brush.extent();
        // if (round) g.select(".brush")
        //   .call(brush.extent(
        //     extent = extent.map(round)
        //   ))
        //   .selectAll(".resize")
        //   .style("display", null);
        // g.select("#clip-" + id + " rect")
        //   .attr("x", x(extent[0]))
        //   .attr("width", x(extent[1]) - x(extent[0]));

        // var selected = [];

        // dimension.filterRange(extent).top(Infinity).forEach(function (d) {
        //   selected.push(d.id)
        // });
        // svg.attr("class", "counties")
        //   .selectAll("path")
        //   .attr("class", function (d) { 
        //     if (selected.indexOf(d.id) >= 0) 
        //     { 
        //       return "q8-9" 
        //     }else if (extant.indexOf(d.id) >= 0) {
        //        return "q5-9" 
        //     } else {
        //        return null; 
        //     } 
        // });
        console.log('brush.chart: '+JSON.stringify(selected))
      });

      brush.on("brushend.chart", function () {
        if (brush.empty()) {
          var div = d3.select(this.parentNode.parentNode.parentNode);
          div.select(".title a").style("display", "none");
          div.select("#clip-" + id + " rect").attr("x", null).attr("width", "100%");
          dimension.filterAll();
        }else{
          var g = d3.select(this.parentNode),
          extent = brush.extent();
        if (round) g.select(".brush")
          .call(brush.extent(
            extent = extent.map(round)
          ))
          .selectAll(".resize")
          .style("display", null);
        g.select("#clip-" + id + " rect")
          .attr("x", x(extent[0]))
          .attr("width", x(extent[1]) - x(extent[0]));

        var selected = [];

        dimension.filterRange(extent).top(Infinity).forEach(function (d) {
          selected.push(d)
        });

        executeFlightPlans(selected);
        console.log('brush.end: '+JSON.stringify(selected))
        }
      });

      chart.margin = function (_) {
        if (!arguments.length) return margin;
        margin = _;
        return chart;
      };

      chart.x = function (_) {
        if (!arguments.length) return x;
        x = _;
        axis.scale(x);
        brush.x(x);
        return chart;
      };

      chart.y = function (_) {
        if (!arguments.length) return y;
        y = _;
        return chart;
      };

      chart.dimension = function (_) {
        if (!arguments.length) return dimension;
        dimension = _;
        return chart;
      };

      chart.filter = function (_) {
        if (_) {
          brush.extent(_);
          dimension.filterRange(_);
        } else {
          brush.clear();
          dimension.filterAll();
        }
        brushDirty = true;
        return chart;
      };

      chart.group = function (_) {
        if (!arguments.length) return group;
        group = _;
        return chart;
      };

      chart.round = function (_) {
        if (!arguments.length) return round;
        round = _;
        return chart;
      };

      return d3.rebind(chart, brush, "on");
    }
    // Renders the specified chart or list
    function render(method) {
      d3.select(this).call(method);
    }

    // Whenever the brush moves, re-rendering everything.
    function renderAll() {
      chart.each(render);
    }
  
    function launchPlannedAnimation(fligthFeatures){
      //remove running animation
      executeFlightPlans(fligthFeatures);

    }
    function launchMockAnimation(){
      setInterval(function () {
        if (isRunning) {
          var regularPoints = [];
          var plannedPoints = [];
          for (var index = 0; index < OD_PAIRS.length; index++) {
            if (index == OD_PAIRS.length) {
              index = 0;
            }
            var od = OD_PAIRS[index];
            var point = [od[0], od[1]];
            if ("regular" !== od[2]) {
              plannedPoints.push(point);
            }
          }
          fly(plannedPoints, "planned");
        }
      }, 5000);

      var i = 0;
      setInterval(function () {
        if (isRunning) {

          if (i > OD_PAIRS.length - 1) {
            i = 0;
          }
          var pt = OD_PAIRS[i];
          if (pt[2] === "regular") {
            flyPointToPoint(pt[0], pt[1]);
          }
          i++;

        }
      }, 150);
    }
  
  
  
  
  }

  function removeAllFligths(){

  }
  function transition(plane, route) {
    var l = route.node().getTotalLength();
    plane.transition()
      .duration(l * 100)
      .attrTween("transform", delta(plane, route.node()))
      .each("end", function () { route.remove(); })
      .remove();
  }

  function delta(plane, path) {
    var l = path.getTotalLength();
    var plane = plane;
    return function (i) {
      return function (t) {
        var p = path.getPointAtLength(t * l);

        var t2 = Math.min(t + 0.05, 1);
        var p2 = path.getPointAtLength(t2 * l);

        var x = p2.x - p.x;
        var y = p2.y - p.y;
        var r = 90 - Math.atan2(-y, x) * 180 / Math.PI;

        var s = Math.min(Math.sin(Math.PI * t) * 0.5, 0.2);

        return "translate(" + p.x + "," + p.y + ") scale(" + s + ") rotate(" + r + ")";
      }
    }
  }

  

  

  /*Execute animation over fligthPlan animation */
  function executeFlightPlans(selectedPlans){
    
    for (var i = 0; i < selectedPlans.length; i++) {
      (function (i) {
        //to unblock thread
        setTimeout(function () {
          executeFlightPlan(selectedPlans[i])
        }, 200*i);
      })(i);
    };
      
  }
  
  function executeFlightPlan(fligthPlanFeature){
       

    var route = svg.append("path").datum(fligthPlanFeature.geometry).attr("class", "route").attr("d", path);
    var plane = svg.append("path")
    .attr("d", "m25.21488,3.93375c-0.44355,0 -0.84275,0.18332 -1.17933,0.51592c-0.33397,0.33267 -0.61055,0.80884 -0.84275,1.40377c-0.45922,1.18911 -0.74362,2.85964 -0.89755,4.86085c-0.15655,1.99729 -0.18263,4.32223 -0.11741,6.81118c-5.51835,2.26427 -16.7116,6.93857 -17.60916,7.98223c-1.19759,1.38937 -0.81143,2.98095 -0.32874,4.03902l18.39971,-3.74549c0.38616,4.88048 0.94192,9.7138 1.42461,13.50099c-1.80032,0.52703 -5.1609,1.56679 -5.85232,2.21255c-0.95496,0.88711 -0.95496,3.75718 -0.95496,3.75718l7.53,-0.61316c0.17743,1.23545 0.28701,1.95767 0.28701,1.95767l0.01304,0.06557l0.06002,0l0.13829,0l0.0574,0l0.01043,-0.06557c0,0 0.11218,-0.72222 0.28961,-1.95767l7.53164,0.61316c0,0 0,-2.87006 -0.95496,-3.75718c-0.69044,-0.64577 -4.05363,-1.68813 -5.85133,-2.21516c0.48009,-3.77545 1.03061,-8.58921 1.42198,-13.45404l18.18207,3.70115c0.48009,-1.05806 0.86881,-2.64965 -0.32617,-4.03902c-0.88969,-1.03062 -11.81147,-5.60054 -17.39409,-7.89352c0.06524,-2.52287 0.04175,-4.88024 -0.1148,-6.89989l0,-0.00476c-0.15655,-1.99844 -0.44094,-3.6683 -0.90277,-4.8561c-0.22699,-0.59493 -0.50356,-1.07111 -0.83754,-1.40377c-0.33658,-0.3326 -0.73578,-0.51592 -1.18194,-0.51592l0,0l-0.00001,0l0,0z");
    //.on('mouseover', geomniFlyDetails)
    //.on('mouseout',removeGeomniFlyDetails);

    

    transition(plane, route);
  }
  function geomniFlyDetails() {
    alert("Fly: GEOM-01\nShoots Number: 1500");
  }
  function removeGeomniFlyDetails() {
    window.alert = function() {};
  }
  /*Create fligth data for bars*/

  window.filter = function (filters) {
    filters.forEach(function (d, i) { 
      charts[i].filter(d);
     });
    renderAll();
  };

  window.reset = function (i) {
    charts.forEach(function (c) {
      c.filter(null);
    })
    renderAll();
    svg.attr("class", "counties")
      .selectAll("path")
      .attr("class", function (d) { 
        var qua = quantize(fligthsById.get(d.id));
        return qua; 
      });
  };

  $(window).resize(function () {
    currentWidth = $("#map").width();
    svg.attr("width", currentWidth);
    svg.attr("height", currentWidth * height / width);
  });  
});