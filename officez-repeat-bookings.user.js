// ==UserScript==
// @name     Officez Repeat Bookings
// @version  2
// @include  https://officez.herokuapp.com/bookings/*
// @noframes
// @require  https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require  https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.22.2/moment.min.js
// @grant    none
// ==/UserScript==

const repeats = { one: 'Week', odd: 'Odd week', even: 'Even week' };
const days = { '8': 'Monday', '9': 'Tuesday', '10': 'Wednesday', '11': 'Thursday', '12': 'Friday' };
const rooms = {};

function initialize() {
  if ($('.repeat-bookings').length) {
    return;
  }

  if ($('select#booking_user_id').length) {
    return;
  }

  $('#booking_room_id_for_building_2 option:not(:first-child)').each((_, option) => {
    rooms[option.value] = option.label;
  });

  const $panel = $('<div class="panel panel-default repeat-bookings"><div class="panel-heading">' +
                   '<h3 class="panel-title">Repeat Bookings</h3>' +
                   '<div class="panel-options"><a href="#" data-toggle="panel">' +
                   '<span class="collapse-icon">–</span><span class="expand-icon">+</span></a></div>' +
                   '</div></div>');
  const $form = $('<div class="panel-body"><form id="repeat_booking" class="form-horizontal">' +
                  '</form></div>').appendTo($panel).find('form').submit(() => false);
  const $group = $('<div class="form-group"></div>').appendTo($form);
  const $repeat = $('<label class="col-sm-1 control-label">Every</label><div class="col-sm-1"><select class="form-control">' +
                    options(repeats) + '</select></div>').appendTo($group).find('select');
  const $day = $('<label class="col-sm-1 control-label">On</label><div class="col-sm-1"><select class="form-control">' +
                 options(days) + '</select></div>').appendTo($group).find('select');
  const $start = $('<label class="col-sm-1 control-label">From</label><div class="col-sm-1">' +
                   '<input class="form-control timepicker" data-template="dropdown" data-show-seconds="false" ' +
                   'data-default-time="9:00" data-show-meridian="false" data-minute-step="15" type="text">' +
                   '</div>').appendTo($group).find('input');
  const $end = $('<label class="col-sm-1 control-label">To</label><div class="col-sm-1">' +
                 '<input class="form-control timepicker" data-template="dropdown" data-show-seconds="false" ' +
                 'data-default-time="10:00" data-show-meridian="false" data-minute-step="15" type="text">' +
                 '</div>').appendTo($group).find('input');
  const $room = $('<label class="col-sm-1 control-label">In</label><div class="col-sm-2"><select class="form-control">' +
                  options(rooms) + '</select></div>').appendTo($group).find('select');
  const $save = $('<div class="col-sm-1"><input value="Remember" class="btn btn-primary btn-single pull-right" type="button">' +
                  '</div>').appendTo($group).find('input');
  const $render = $('<div>').appendTo($form);

  $save.click(() => {
    localStorage.setItem('repeat-bookings', JSON.stringify(JSON.parse(
      localStorage.getItem('repeat-bookings') || '[]').concat(
      {
        repeat: $repeat.val(),
        day: $day.val(),
        start: $start.val(),
        end: $end.val(),
        room: $room.val(),
      })));
    render($render);
  });

  render($render);

  $('.panel-title:contains("New Booking")').closest('.panel').after($panel);
}

function options(object) {
  let result = '';
  for (const value in object) {
    result += `<option value="${value}">${object[value]}</option>`;
  }
  return result;
}

function render($render) {
  $render.empty();
  const $list = $('<ul class="list-group" style="color: #333;">').appendTo($render);
  const repeatBookings = JSON.parse(localStorage.getItem('repeat-bookings') || '[]');
  for (const repeatBooking of repeatBookings) {
    const $remove = $('<li class="list-group-item">' + description(repeatBooking) +
                      '<input value="Forget" class="btn btn-xs btn-single btn-danger pull-right" type="button">' +
                      '</li>').appendTo($list).find('input');
    $remove.click(() => {
      localStorage.setItem('repeat-bookings', JSON.stringify(JSON.parse(
        localStorage.getItem('repeat-bookings') || '[]').filter(item => !(
          item.repeat === repeatBooking.repeat &&
          item.day === repeatBooking.day &&
          item.start === repeatBooking.start &&
          item.end === repeatBooking.end &&
          item.room === repeatBooking.room))));
      render($render);
    });
  }

  if (repeatBookings.length) {
    const $makeBookings = $('<input value="Make Bookings (there is no undo!)" ' +
                            'class="btn btn-primary btn-single" type="button">').appendTo($render);
    const $results = $('<ul style="color: #333; margin-top: 15px; margin-bottom: 0;"></ul>').appendTo($render);
    $makeBookings.click(() => {
      $('.repeat-bookings :input').addClass('disabled');
      $results.empty();
      (function loop(i) {
        if (i < repeatBookings.length) {
          const $result = $(`<li>${description(repeatBookings[i])}<ul></ul></li>`).appendTo($results).find('ul');
          let nextMoment = moment().add((Number(repeatBookings[i].day) - moment().day()) % 7, 'day');
          if ((repeatBookings[i].repeat === 'odd' && nextMoment.week() % 2 === 0) ||
              (repeatBookings[i].repeat === 'even' && nextMoment.week() % 2 === 1)) {
            nextMoment = nextMoment.add(1, 'week');
          }

          (function innerLoop() {
            if (nextMoment.isBefore(moment().add(2, 'month'))) {
              book(nextMoment.format('YYYY-MM-DD'),
                   repeatBookings[i].start.padStart(5, '0'),
                   repeatBookings[i].end.padStart(5, '0'),
                   repeatBookings[i].room,
                   (err, res) => {
                if (err) {
                  $result.append(`<li>${nextMoment.format('D-MM-YYYY')}: ERROR: ${err}</li>`);
                } else {
                  $result.append(`<li>${nextMoment.format('D-MM-YYYY')}: ${res}</li>`);
                  nextMoment = nextMoment.add(repeatBookings[i].repeat === 'one' ? 1 : 2, 'week');
                  innerLoop();
                }
              });
            } else {
              loop(i + 1);
            }
          }());
        } else {
          $('.repeat-bookings input').removeClass('disabled');
        }
      }(0));
    });
  }
}

function description(repeatBooking) {
  return `Every ${repeats[repeatBooking.repeat].toLowerCase()} on ` +
    `${days[repeatBooking.day].toLowerCase()} from ${repeatBooking.start} to ` +
    `${repeatBooking.end} in ${rooms[repeatBooking.room]}`;
}

function book(date, start, end, room, cb) {
  $.get(`/bookings/${date}`)
    .done(html => {
      const $html = $(html);
      const authenticityToken = $html.find('input[name="authenticity_token"]').attr('value');
      const userId = $html.find('#booking_user_id').attr('value');
      const script = $html.find('script').last().html();
      const json = script.substring(script.indexOf('.fullCalendar(') + 14, script.indexOf('});') - 4);
      let calendar;
      eval(`calendar = ${json}`);

      if (calendar.events.some(event =>
                               event.url &&
                               event.resourceId === Number(room) &&
                               event.start === `${date}T${start}:00` &&
                               event.end === `${date}T${end}:00`)) {
        return cb(null, 'Already booked by you');
      }

      let overlap;
      const ourStart = moment(`${date} ${start}`, 'YYYY-MM-DD HH:mm');
      const ourEnd = moment(`${date} ${end}`, 'YYYY-MM-DD HH:mm');
      for (const event of calendar.events) {
        if (event.resourceId === Number(room)) {
          const start = moment(event.start, 'YYYY-MM-DDTHH:mm:ss');
          const end = moment(event.end, 'YYYY-MM-DDTHH:mm:ss');
          if (start.isBefore(ourEnd) && end.isAfter(ourStart)) {
            overlap = (overlap ? overlap + ', ' : 'Overlap with ') + event.title;
          }
        }
      }
      if (overlap) {
        return cb(null, overlap);
      }

      $.post('/bookings', {
          authenticity_token: authenticityToken,
          'booking[room_id]': room,
          'booking[start_datetime][date]': date,
          'booking[start_datetime][time]': start,
          'booking[end_datetime][date]': date,
          'booking[end_datetime][time]': end,
          'booking[user_id]': userId,
          'building[id]': '2',
          commit: 'Create+Booking',
          utf8: '✓',
        })
        .done(result => {
          if (result.includes('Booking was successfully created.')) {
            cb(null, 'Now booked by you!');
          } else {
            cb('Something went wrong (not-created)');
          }
        })
        .fail(() => {
          cb('Something went wrong (post-fail)');
        });
    })
    .fail(() => {
      cb('Something went wrong (get-fail)');
    });
}

initialize();
