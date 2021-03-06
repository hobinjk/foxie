import SkillData from 'gw2-data/SkillData';
import SkillIds from 'gw2-data/SkillIds';
import EIParser from './EIParser';
import drawCastTimeline from 'ventaris-tablet/drawCastTimeline';
import drawDpsGraph from 'ventaris-tablet/drawDpsGraph';

const setupContainer = document.querySelector('.setup-container');
setup();

const videoEnabled = false;

async function setup() {
  const dpsReportText = document.querySelector('.dpsreport-text');
  const dpsReportSubmit = document.querySelector('.dpsreport-submit');

  function dpsReportListener() {
    let urlText = dpsReportText.value.trim();
    if (!/^https:\/\/(dps|wvw)\.report\/[^/]+$/.test(urlText)) {
      alert('Paste in format https://dps.report/Sosx-20180802-193036_cairn');
      return;
    }
    let url = new URL(urlText);
    dpsReportSubmit.value = 'Fetching';
    dpsReportSubmit.removeEventListener('click', dpsReportListener);
    dpsReportSubmit.removeEventListener('keypress', dpsTextListener);
    loadDpsReport(url.pathname.substr(1));
  }

  function dpsTextListener(event) {
    if (event.key === 'Enter') {
      dpsReportListener();
    }
  }

  dpsReportSubmit.addEventListener('click', dpsReportListener);
  dpsReportText.addEventListener('keypress', dpsTextListener);

  let logInput = document.getElementById('log-input');
  logInput.addEventListener('change', function() {
    let logLabel = document.querySelector('#log-input + label');
    logLabel.textContent = 'Parsing';

    let file = logInput.files[0];

    setTimeout(function() {
      loadEIJson(file);
    }, 100);
  });
  setupContainer.classList.remove('hidden');

  let videoContainer = document.querySelector('.gameplay-video-container');
  let video = document.querySelector('.gameplay-video');
  let videoInput = document.getElementById('video-input');
  videoInput.addEventListener('change', function() {
    let logLabel = document.querySelector('#video-input + label');
    logLabel.textContent = 'Uploading';

    let file = videoInput.files[0];

    setTimeout(function() {
      const reader = new FileReader();
      reader.onload = function(event) {
        let source = document.createElement('source');
        source.src = event.target.result;
        source.type = file.type;

        video.appendChild(source);

        videoContainer.classList.remove('no-video');
      };
      reader.onprogress = function(event) {
        if (event.lengthComputable) {
          let percent = Math.floor(100 * event.loaded / event.total) + '%';
          logLabel.textContent = 'Uploading ' + percent;
        }
      };

      reader.readAsDataURL(file);
    }, 100);
  });
}

function loadEIJson(file) {
  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const contents = event.target.result;
      let log = EIParser.parseJson(JSON.parse(contents));
      setupContainer.classList.add('hidden');
      displayLog(log);
    } catch (_e) {
      alert('Failed to parse log file, should be JSON blob');
    }
  };
  reader.readAsText(file);
}

function loadDpsReport(slug) {
  EIParser.getJson(slug).then(function(log) {
    if (!log) {
      // TODO: should reset state of app
      return;
    }
    setupContainer.classList.add('hidden');
    displayLog(log);
  }).catch(_ => {
    alert('failed to fetch that log, typo maybe?');
  });
}

async function displayLog(log) {
  for (let playerId in log.casts) {
    log.casts[playerId].sort(function(a, b) {
      return a.start - b.start;
    });
  }

  const usedSkills = {};
  for (let playerId in log.casts) {
    for (let cast of log.casts[playerId]) {
      usedSkills[cast.id] = true;
    }
  }

  for (let id in log.skills) {
    if (!/^[A-Z]/.test(log.skills[id])) {
      continue;
    }
    usedSkills[id] = true;
  }

  await SkillData.load(usedSkills);

  document.querySelector('.container').classList.remove('hidden');
  const width = (log.end - log.start) / 20; // 20 ms = 1 pixel
  const railHeight = 20;
  const railPad = 4;

  const timeline = document.querySelector('.timeline');
  const video = document.querySelector('.gameplay-video');
  const boardContainer = document.createElement('div');
  boardContainer.classList.add('board-container');
  const board = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  board.style.width = width + 'px';
  board.classList.add('board');
  boardContainer.appendChild(board);

  const legend = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  legend.classList.add('legend');

  const needle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  needle.setAttribute('x', 0);
  needle.setAttribute('y', 0);
  needle.setAttribute('width', 2);
  needle.classList.add('needle');
  board.appendChild(needle);

  timeline.appendChild(legend);
  timeline.appendChild(boardContainer);

  function timeToX(time) {
    return width * (time - log.start) / (log.end - log.start);
  }

  function xToTime(x) {
    return (x / width) * (log.end - log.start) + log.start;
  }

  const bonusSkills = {
    [SkillIds.ATTUNEMENT_FIRE_FIRE]: 'Fire/Fire',
    [SkillIds.ATTUNEMENT_FIRE_AIR]: 'Fire/Air',
    [SkillIds.ATTUNEMENT_FIRE_WATER]: 'Fire/Water',
    [SkillIds.ATTUNEMENT_FIRE_EARTH]: 'Fire/Earth',
    [SkillIds.ATTUNEMENT_AIR_AIR]: 'Air/Air',
    [SkillIds.ATTUNEMENT_AIR_WATER]: 'Air/Water',
    [SkillIds.ATTUNEMENT_AIR_FIRE]: 'Air/Fire',
    [SkillIds.ATTUNEMENT_WATER_FIRE]: 'Water/Fire',
    [SkillIds.ATTUNEMENT_WATER_EARTH]: 'Water/Earth',
    [SkillIds.ATTUNEMENT_EARTH_EARTH]: 'Earth/Earth',
    [SkillIds.ATTUNEMENT_EARTH_AIR]: 'Earth/Air',
    [SkillIds.ATTUNEMENT_EARTH_FIRE]: 'Earth/Fire',
  };

  for (const id in bonusSkills) {
    log.skills[id] = bonusSkills[id];
  }

  const dimensions = {
    railHeight,
    railPad,
    width,
    timeToX,
    xToTime,
  };

  const options = {
    showDps: false,
    sortByProfession: false,
    showIcons: true,
  };
  const showDps = document.getElementById('show-dps');
  showDps.checked = options.showDps;
  const sortByProfession = document.getElementById('sort-by-profession');
  sortByProfession.checked = options.sortByProfession;
  const showIcons = document.getElementById('show-icons');
  showIcons.checked = options.showIcons;

  function onChange(key) {
    return function(event) {
      options[key] = event.target.checked;
      drawBoard(log, dimensions, options);
    };
  }
  showDps.addEventListener('change', onChange('showDps'));
  sortByProfession.addEventListener('change', onChange('sortByProfession'));
  showIcons.addEventListener('change', onChange('showIcons'));

  drawBoard(log, dimensions, options);

  let boardContainerRect = boardContainer.getBoundingClientRect();

  function scrollToLogTime(logTime, scrollVideo) {
    const logX = timeToX(logTime);
    needle.setAttribute('x', logX);
    if (!scrollVideo || logX < boardContainer.scrollLeft ||
        logX > boardContainer.scrollLeft + boardContainerRect.width) {
      boardContainer.scrollLeft = logX - boardContainerRect.width / 2;
    }
    if (scrollVideo && videoEnabled) {
      video.currentTime = (logTime - log.start) / 1000 + options.videoOffset;
    }
  }

  board.addEventListener('click', function(event) {
    let totalX = event.clientX + boardContainer.scrollLeft -
      boardContainerRect.left;
    let logTime = xToTime(totalX);
    scrollToLogTime(logTime, true);
  });

  document.body.addEventListener('click', function(event) {
    if (event.target.classList.contains('time-link')) {
      event.preventDefault();
      let start = parseFloat(event.target.dataset.start);
      if (start) {
        scrollToLogTime(start, true);
      }
    }
  });

  video.addEventListener('timeupdate', function() {
    scrollToLogTime((video.currentTime - options.videoOffset) * 1000 +
                    log.start);
  });
}

function createDoubledTitle(textContent) {
  const title = document.createElementNS('http://www.w3.org/2000/svg',
                                         'title');
  title.textContent = textContent;
  const titleInner = document.createElementNS('http://www.w3.org/2000/svg',
                                              'title');
  titleInner.textContent = textContent;
  const use = document.createElementNS('http://www.w3.org/2000/svg',
                                       'use');
  use.setAttribute('xlink:href', '#adjust-solid');
  use.appendChild(titleInner);

  return [title, use];
}

function group(log, playerId) {
  return log.players[playerId].group;
}

function profession(log, playerId) {
  return log.players[playerId].profession;
}

function drawBoard(log, dimensions, options) {
  const {railHeight, railPad} = dimensions;

  const board = document.querySelector('.board');
  const legend = document.querySelector('.legend');
  const needle = document.querySelector('.needle');
  board.innerHTML = '';
  legend.innerHTML = '';

  let row = 0;

  if (options.showDps) {
    let targetDamage1S = [];
    for (let player of log.players) {
      let damage = player.damage1S[0];
      for (let i = 0; i < damage.length; i++) {
        if (i >= targetDamage1S.length) {
          targetDamage1S.push(0);
        }
        targetDamage1S[i] += damage[i];
      }
    }
    log.targetDamage1S = targetDamage1S;
    drawDpsGraph(board, log, {targetDamage1S: []}, dimensions, true);
    const dpsGraphLabel = document.createElementNS('http://www.w3.org/2000/svg',
                                                   'text');
    dpsGraphLabel.textContent = 'Damage per 10s';
    dpsGraphLabel.setAttribute('x', 0);
    dpsGraphLabel.setAttribute('y', railHeight / 2);
    dpsGraphLabel.classList.add('name');
    legend.appendChild(dpsGraphLabel);

    row += 3;
  }

  let playerIds = Object.keys(log.casts);
  if (options.sortByProfession) {
    playerIds.sort(function(a, b) {
      return profession(log, a).localeCompare(profession(log, b));
    });
  } else {
    playerIds.sort(function(a, b) {
      return group(log, a) - group(log, b);
    });
  }

  for (let playerId of playerIds) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const name = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const player = log.players[playerId];
    const [title, use] = createDoubledTitle(player.account);
    name.textContent = player.name;
    name.setAttribute('x', 0);
    name.setAttribute('y', row * (railHeight + railPad) + railHeight / 2);
    name.classList.add('name');
    g.appendChild(title);
    g.appendChild(use);
    g.appendChild(name);
    legend.appendChild(g);

    drawCastTimeline(board, log, log.casts[playerId], row, dimensions, null,
                     options.showIcons ? 'icon' : 'name');
    row += 1;
  }


  const buffCount = 0;
  // drawBuffTimeline(board, legend, log, row + 1, dimensions,
  //                                   options.showBoringBuffs, false);

  const rowCount = buffCount + row;
  board.style.height = rowCount * (railHeight + railPad) - railPad + 'px';
  legend.style.height = rowCount * (railHeight + railPad) - railPad + 'px';

  needle.setAttribute('height', rowCount * (railHeight + railPad) - railPad);
  board.appendChild(needle);
}
