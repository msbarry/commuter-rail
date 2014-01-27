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
        body.Messages.forEach(function (msg) {
          var inbound = msg.Destination === 'South Station' || msg.Destionation === 'North Station';
          var dir = inbound ? 'inbound' : 'outbound';
          schedules[num - 1][dir].push({
            stop: msg.Stop,
            time: (+msg.Scheduled + +msg.Lateness) * 1000,
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
        .attr('class', 'panel panel-default');
    
    newOuterPanel
      .append('div')
        .attr('class', 'panel-heading')
      .append('h4')
        .attr('class', 'panel-title')
      .append('a')
        .attr('data-toggle', 'collapse')
        .attr('data-parent', '#accordian')
        .attr('href', function (d) { return '#collapse' + d.index; })
        .text(function (d) { return d.name; });

    var body = newOuterPanel
      .append('div')
        .attr('id', function (d) { return 'collapse' + d.index; })
        .attr('class', 'panel-collapse collapse')
        .classed('in', function (d) {
          if (window.localStorage) {
            return !!localStorage.getItem('collapse' + d.index);
          }
          return false;
        })
      .append('div')
        .attr('class', 'panel-body container')
        .attr('id', function (d) { return 'body' + d.index; });

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
  }());

  d3.csv('StationOrder.csv', function (d) {
    setTimeout(poll);
    stationOrder = d;

    d.forEach(function (d) {
      var dir = +d.direction_id ? 'inbound' : 'outbound';
      var route = d.route_long_name;
      var stop = d.stop_id;
      stopOrders[route + '|' + dir + '|' + stop] = +d.stop_sequence;
      d.dir = dir;
    });
    navigator.geolocation.getCurrentPosition(function (p) {
      var location = [p.coords.latitude, p.coords.longitude];
      d.sort(function (a, b) {
        return d3.ascending(distance(a, location), distance(b, location));
      });
      console.log("Your closest stops are " + d.slice(0, 5).map(function (d) { return d.stop_id + " " + d.dir; }));
    });
  });

  function distance(a, b) {
    var pos = [+a.stop_lat, +a.stop_lon];
    var dx = pos[0] - b[0];
    var dy = pos[1] - b[1];
    return dx * dx + dy * dy;
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
