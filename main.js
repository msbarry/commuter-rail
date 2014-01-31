(function ($) {
  "use strict";
  var LINES = [
    'Greenbush Line',
    'Kingston/Plymouth Line',
    'Middleborough/Lakeville Line',
    'Fairmount Line',
    'Providence/Stoughton Line',
    'Franklin Line',
    'Needham Line',
    'Framingham/Worcester Line',
    'Fitchburg Line',
    'Lowell Line',
    'Haverhill Line',
    'Newburyport/Rockport Line'
  ];
  var CLOSEST_TO_SHOW = 6;
  var schedules = LINES.map(function (line, i) {
    return {
      name: line,
      inbound: [],
      outbound: [],
      index: i
    };
  });
  var stopOrders = {};
  var closest = [];
  var sourceToDestList = {};
  var EARTH_RADIUS = 6371000 / 1609; // determines unit of distance, use miles

  setInterval(draw, 1000);
  /**
   * Request current locations from the MBTA
   */
  function poll () {
    for (var i = 1; i <= 12; i++) {
      makeRequest(i);
    }
    setTimeout(poll, 30000);
  }

  function makeRequest(num) {
    d3.jsonp('http://jsonpwrapper.com/?callback={callback}&' + encodeURIComponent("urls[]") + '=' + encodeURIComponent('http://developer.mbta.com/lib/RTCR/RailLine_' + num + '.json'), function (data) {
      var body = JSON.parse(data[0].body);
      if (body.Messages) {
        schedules[num - 1].trains = [];
        var alreadyHit = {};
        body.Messages.forEach(function (msg) {
          var inbound = msg.Destination === 'South Station' || msg.Destionation === 'North Station';
          var dir = inbound ? 'inbound' : 'outbound';
          var time = (+msg.Scheduled + (+msg.Lateness)) * 1000;
          if (msg.Flag === 'app') {
            time = (+msg.TimeStamp + 60) * 1000;
          } else if (msg.Flag === 'arr') {
            time = (+msg.TimeStamp) * 1000;
          } else if (msg.Flag === 'dep') {
            time = (+msg.TimeStamp - 60) * 1000;
          }
          if ((+msg.TimeStamp * 1000) - (time) > 300000) {
            return;
          }
          sourceToDestList[msg.Stop] = sourceToDestList[msg.Stop] || {};
          if (!alreadyHit[msg.Stop + "-" + msg.Destination]) {
            alreadyHit[msg.Stop + "-" + msg.Destination] = true;
            sourceToDestList[msg.Stop][msg.Destination] = [];
          }
          var record = {
            stop: msg.Stop,
            time: time,
            lateness: +msg.Lateness,
            id: msg.Stop + msg.Trip,
            flag: msg.Flag,
            dest: msg.Destination,
            order: stopOrders[LINES[num - 1] + '|' + dir + '|' + msg.Stop],
            pos: [+msg.Latitude, +msg.Longitude],
            heading: +msg.Heading
          };
          sourceToDestList[msg.Stop][msg.Destination].push(record);
          schedules[num - 1][dir].push(record);
        });
      }
    });
  }

  /**
   * Render the locations on the page, and update countdowns
   */
  function draw () {
    // var outerPanel = d3.select('#accordion')
    //     .selectAll('div')
    //     .data(
    //       schedules.filter(function (d) { return d.inbound.length || d.outbound.length; }),
    //       function (d) { return d.name; }
    //     );

    // var newOuterPanel = outerPanel
    //     .enter()
    //   .append('div')
    //     .call(bootstrapCollapsePanel(function (d) { return d.index; }, function (d) { return d.name; }));

    // var body = newOuterPanel.selectAll('.panel-body');
    // body.append('div')
    //     .attr('class', 'col-sm-6 inbound')
    //   .append('h4')
    //     .text('Inbound');
    // body.append('div')
    //     .attr('class', 'col-sm-6 outbound')
    //   .append('h4')
    //     .text('Outbound');

    // // outerPanel.exit().remove();


    // function renderTrains(dir) {
    //   var trains = d3.selectAll('.panel-body .' + dir).selectAll('p')
    //       .data(function (d) { return d[dir]; }, function (d) { return d.id; })
    //       .sort(function (a, b) {
    //         return d3.ascending(a.order, b.order) || d3.ascending(a.time, b.time);
    //       })
    //       .text(function (d) { return d.stop + ': ' + moment(d.time).fromNow(); });

    //   trains.enter()
    //     .append('p')
    //       .text(function (d) { return d.stop + ': ' + moment(d.time).fromNow(); });

    //   trains.exit().remove();
    // }

    // renderTrains('inbound');
    // renderTrains('outbound');

    var closeSections = d3.select('#closest').selectAll('.close-station')
        .data(closest, function (d) { return d.name; });
    closeSections
        .enter()
      .append('div')
        .call(bootstrapCollapsePanel(
          function (d) { return d.name.replace(/[^a-zA-Z]*/g, ''); },
          function (d) { return d.name; },
          '#closest'))
        .classed('close-station', true);
    closeSections.exit().remove();

    d3.selectAll('.distance')
        .text(function (d) {
          var miles = Math.round(d.dist * 10) / 10;
          var feet = Math.round(d.dist * 5280 / 10) * 10;
          return feet <= 1000 ? (feet + " ft") : (miles + " mi");
        });

    d3.selectAll('.close-station')
        .sort(function (a, b) { return d3.ascending(a.dist, b.dist); });

    function toPairs(object) {
      if (!object) { return []; }
      var keys = Object.keys(object);
      return keys.map(function (k) {
        return [k, object[k]];
      });
    }

    // destination, next, next
    var displays = d3.selectAll('.close-station .panel-body').selectAll('.dest')
        .data(function (d) { return toPairs(sourceToDestList[d.name]).filter(function (d2) { return d !== d2[0]; }); }, function (d) { return d[0]; });
    displays.enter().append('dl')
        .attr('class', 'dest')
      .append('dt')
        .text(function (d) { return 'To ' + d[0]; });
    displays.exit().remove();

    var times = displays.selectAll('.time')
        .data(function (d) { return d[1].slice(0, 2); })
        .sort(function (a, b) {
          return d3.ascending(a.time, b.time);
        });
    times.enter().append('dd')
        .attr('class', 'time');
    times.exit().remove();
    displays.selectAll('.time').text(function (d) {
      var diff = moment(d.time).fromNow();
      if (d.flag === 'arr') {
        var dist = distance(d.pos, stopLocations[d.stop]);
        var movingAway = !isApproaching(d.pos, stopLocations[d.stop], d.heading);
        return (dist > 0.1 && movingAway ? 'left station' : 'boarding now');
      } else if (d.flag === 'app') {
        return 'approaching station';
      }
      if (d.lateness) {
        diff += " (" + moment.duration(d.lateness, 'seconds').humanize() + " late)";
      }
      return diff;
    }).attr('class', function (d) {
      return 'time ' + d.flag;
    });
  }

  var stopLocations = {};
  setTimeout(poll);

  window.stations.forEach(function (d) {
    var dir = +d.direction_id ? 'inbound' : 'outbound';
    var route = d.route_long_name;
    var stop = d.stop_id;
    stopOrders[route + '|' + dir + '|' + stop] = +d.stop_sequence;
    d.dir = dir;
    stopLocations[stop] = [+d.stop_lat, +d.stop_lon];
  });

  function plotCoord(p) {
    var location = [p.coords.latitude, p.coords.longitude];
    var locationsWithDistance = Object.keys(stopLocations).map(function (stop) {
      return {
        name: stop,
        dist: distance(stopLocations[stop], location)
      };
    });
    closest = locationsWithDistance.sort(function (a, b) {
      return d3.ascending(a.dist, b.dist);
    }).slice(0, CLOSEST_TO_SHOW);
    if (window.localStorage) {
      localStorage.setItem("loc", JSON.stringify(p));
    }
  }

  navigator.geolocation.watchPosition(plotCoord);

  function distance(aIn, bIn) {
    var a = aIn.map(toRad);
    var b = bIn.map(toRad);
    var dLat = (a[0] - b[0]);
    var dLon = (a[1] - b[1]) * Math.cos((a[0] + b[0]) / 2);
    var result = Math.sqrt(dLat * dLat + dLon * dLon) * EARTH_RADIUS;
    return result;
  }

  function toRad(deg) {
    return deg * Math.PI / 180;
  }

  function toDeg(rad) {
    return (360 + rad * 180 / Math.PI) % 360;
  }

  function heading(a, b) {
    var aRads = a.map(toRad);
    var bRads = b.map(toRad);
    var dLon = bRads[1] - aRads[1];
    var lat1 = aRads[0];
    var lat2 = bRads[0];
    var y = Math.sin(dLon) * Math.cos(lat2);
    var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return toDeg(Math.atan2(y, x));
  }

  function isApproaching(a, b, trainDir) {
    var dirTo = heading(a, b);
    var diff = (360 + trainDir - dirTo) % 360;
    var normalized = diff > 180 ? diff - 360 : diff;
    var normalizedDiff = Math.abs(normalized);
    return normalizedDiff < 90;
  }


  function bootstrapCollapsePanel(idGenerator, nameGenerator) {
    return function (newOuterPanel) {
      var header = newOuterPanel
          .attr('class', 'panel panel-default')
        .append('div')
          .attr('class', 'panel-heading')
        .append('h4')
          .attr('class', 'panel-title');

      header.append('a')
          .attr('data-toggle', 'collapse')
          .attr('href', function (d, i) { return '#collapse' + idGenerator(d, i); })
          .text(function (d, i) { return nameGenerator(d, i); });

      header.append('span')
          .attr('class', 'distance text-muted pull-right');

      newOuterPanel
        .append('div')
          .attr('id', function (d, i) { return 'collapse' + idGenerator(d, i); })
          .attr('class', 'panel-collapse collapse')
          .classed('in', function (d, i) {
            if (window.localStorage) {
              return 'true' === localStorage.getItem('collapse' + idGenerator(d, i));
            }
            return false;
          })
        .append('div')
          .attr('class', 'panel-body container')
          .attr('id', function (d, i) { return 'body' + idGenerator(d, i); });
    };
  }

  $(document).on('show.bs.collapse', function (d) {
    if (window.localStorage) {
      var open = $(d.target).attr('id');
      localStorage.setItem(open, true);
    }
  });
  $(document).on('hide.bs.collapse', function (d) {
    if (window.localStorage) {
      var open = $(d.target).attr('id');
      localStorage.setItem(open, false);
    }
  });
  if (window.localStorage) {
    try {
      var pos = localStorage.getItem("loc");
      if (pos) {
        plotCoord(JSON.parse(pos));
      }
    } catch (e) {}
  }
  draw();
}(window.jQuery));