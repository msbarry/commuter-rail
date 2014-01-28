(function () {
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
  var CLOSEST_TO_SHOW = 3;
  var schedules = LINES.map(function (line, i) {
    return {
      name: line,
      inbound: [],
      outbound: [],
      index: i
    };
  });
  var stationOrder = [];
  var stopOrders = {};
  var closest = [];
  var sourceToDestList = {};

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
          sourceToDestList[msg.Stop] = sourceToDestList[msg.Stop] || {};
          if (!alreadyHit[msg.Stop + "-" + msg.Destination]) {
            alreadyHit[msg.Stop + "-" + msg.Destination] = true;
            sourceToDestList[msg.Stop][msg.Destination] = [];
          }
          sourceToDestList[msg.Stop][msg.Destination].push(time);

          schedules[num - 1][dir].push({
            stop: msg.Stop,
            time: time,
            lateness: +msg.Lateness,
            id: msg.Stop + msg.Trip,
            dest: msg.Destination,
            order: stopOrders[LINES[num - 1] + '|' + dir + '|' + msg.Stop]
          });
        });
      }
    });
  }

  /**
   * Render the locations on the page, and update countdowns
   */
  (function draw () {
    setTimeout(draw, 1000);
    var outerPanel = d3.select('#accordion')
        .selectAll('div')
        .data(
          schedules.filter(function (d) { return d.inbound.length || d.outbound.length; }),
          function (d) { return d.name; }
        );

    var newOuterPanel = outerPanel
        .enter()
      .append('div')
        .call(bootstrapCollapsePanel(function (d) { return d.index; }, function (d) { return d.name; }));

    var body = newOuterPanel.selectAll('.panel-body');
    body.append('div')
        .attr('class', 'col-sm-6 inbound')
      .append('h4')
        .text('Inbound');
    body.append('div')
        .attr('class', 'col-sm-6 outbound')
      .append('h4')
        .text('Outbound');

    // outerPanel.exit().remove();


    function renderTrains(dir) {
      var trains = d3.selectAll('.panel-body .' + dir).selectAll('p')
          .data(function (d) { return d[dir]; }, function (d) { return d.id; })
          .sort(function (a, b) {
            return d3.ascending(a.order, b.order) || d3.ascending(a.time, b.time);
          })
          .text(function (d) { return d.stop + ': ' + moment(d.time).fromNow(); });

      trains.enter()
        .append('p')
          .text(function (d) { return d.stop + ': ' + moment(d.time).fromNow(); });

      trains.exit().remove();
    }

    renderTrains('inbound');
    renderTrains('outbound');

    var closeSections = d3.select('#closest').selectAll('.close-station')
        .data(closest, function (d) { return d; });
    closeSections
        .enter()
      .append('div')
        .call(bootstrapCollapsePanel(function (d) { return d.replace(/\s*/g, ''); }, function (d) { return d; }))
        .classed('close-station', true);
    closeSections.exit().remove();

    function toPairs(object) {
      if (!object) { return []; }
      var keys = Object.keys(object);
      return keys.map(function (k) {
        return [k, object[k]];
      });
    }

    // destination, next, next
    var displays = d3.selectAll('.close-station .panel-body').selectAll('.dest')
        .data(function (d) { return toPairs(sourceToDestList[d]).filter(function (d2) { return d !== d2[0]; }); }, function (d) { return d[0]; });
    displays.enter().append('dl')
        .attr('class', 'dest dl-horizontal')
      .append('dt')
        .text(function (d) { return d[0]; });
    displays.exit().remove();

    var times = displays.selectAll('.time')
        .data(function (d) { return d[1].slice(0, 2); })
        .sort(function (a, b) {
          return d3.ascending(a, b);
        });
    times.enter().append('dd')
        .attr('class', 'time');
    times.exit().remove();
    displays.selectAll('.time').text(function (d) { return moment(d).fromNow(); });
  }());

  d3.csv('StationOrder.csv', function (d) {
    var stopLocations = {};
    setTimeout(poll);
    stationOrder = d;

    d.forEach(function (d) {
      var dir = +d.direction_id ? 'inbound' : 'outbound';
      var route = d.route_long_name;
      var stop = d.stop_id;
      stopOrders[route + '|' + dir + '|' + stop] = +d.stop_sequence;
      d.dir = dir;
      stopLocations[stop] = [+d.stop_lat, +d.stop_lon];
    });
    navigator.geolocation.watchPosition(function (p) {
      var location = [p.coords.latitude, p.coords.longitude];
      closest = Object.keys(stopLocations).sort(function (a, b) {
        return d3.ascending(distance(stopLocations[a], location), distance(stopLocations[b], location));
      }).slice(0, CLOSEST_TO_SHOW);
    });
  });

  function distance(a, b) {
    var dx = a[0] - b[0];
    var dy = a[1] - b[1];
    return dx * dx + dy * dy;
  }


  function bootstrapCollapsePanel(idGenerator, nameGenerator) {
    return function (newOuterPanel) {
      newOuterPanel
          .attr('class', 'panel panel-default')
        .append('div')
          .attr('class', 'panel-heading')
        .append('h4')
          .attr('class', 'panel-title')
        .append('a')
          .attr('data-toggle', 'collapse')
          .attr('data-parent', '#accordian')
          .attr('href', function (d, i) { return '#collapse' + idGenerator(d, i); })
          .text(function (d, i) { return nameGenerator(d, i); });

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
}());