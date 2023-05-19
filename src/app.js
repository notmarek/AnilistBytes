import globalCss from './style.css';


let passkey = null; // You still can change this manually
let username = null; // Same here

// Get passkey and username from local storage
passkey = GM_getValue('passkey', null);
username = GM_getValue('username', null);

if (unsafeWindow.location.href.match(/animebytes\.tv/))
  // check which site we are on to run the correct script
  animebytes();
else anilist();

async function animebytes() {
  document.head.append(VM.m(<style>{globalCss}</style>));
  const save = async (e) => {
    e.preventDefault();
    let passkey = document
      .querySelector("link[type='application/rss+xml']")
      .href.match(/\/feed\/rss_torrents_all\/(.*)/)[1];
      let username = document.querySelector('.username').innerText;
      await GM_setValue('passkey', passkey);
      await GM_setValue('username', username);
      alert('Passkey and username set you can now go to anilist!');
      return false;
  }
  let element = (
    <div>
      <h3>AnilistBytes</h3>
      <ul class="nobullet">
        <li>
          <a href="#" onclick={save} id="anilistbytes">{ !passkey && !username ? "Set Passkey & Username" : "Update Passkey & Username" }</a>
        </li>
      </ul>
    </div>
  )
  document.querySelector('#footer_inner').appendChild(VM.m(element));
}

async function getMALId(id, type, isAdult = false) {
  let query = {
    query:
      'query media($id: Int, $type: MediaType, $isAdult: Boolean) { Media(id: $id, type: $type, isAdult: $isAdult) { idMal }}',
    variables: { id, type, isAdult },
  };
  let res = await fetch('https://anilist.co/graphql', {
    body: JSON.stringify(query),
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': unsafeWindow.al_token,
    },
    method: 'POST',
  });
  return (await res.json()).data.Media.idMal;
}

async function anilist() {
  if (passkey === null || username === null) {
    alert(
      'Make sure to press the button in the footer of animebytes or edit the script to set your passkey and username!'
    );
  }

  // stolen from https://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
  function formatBytes(a, b = 2) {
    if (!+a) return '0 Bytes';
    const c = 0 > b ? 0 : b,
      d = Math.floor(Math.log(a) / Math.log(1024));
    return `${parseFloat((a / Math.pow(1024, d)).toFixed(c))} ${
      ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'][d]
    }`;
  }

  const createTorrentEntry = (
    link,
    name,
    size,
    l,
    s,
    snatch,
    downMultipler
  ) => {
    let st = (
      <>
        &nbsp;|&nbsp;
        <a style="color:gray;" href={link}>
          ST
        </a>
      </>
    );
    let flicon = (
      <img
        src="https://anilistbytes.notmarek.com/flicon.png"
        alt="| Freeleech"
      />
    );
    let sneedexicon = (
      <img
        style="margin-left: 5px;"
        src="https://anilistbytes.notmarek.com/sndx.png"
        alt="| Sneedex"
      />
    );
    let anime =
      downMultipler === 0 ? (
        <>
          {name.replace('| Freeleech', '')}
          {flicon}
        </>
      ) : (
        <>{name}</>
      );
    anime = sneedex.includes(link.match(/torrent\/(\d+)\/download/)[1]) ? (
      <>
        {anime}
        {sneedexicon}
      </>
    ) : (
      <>{anime}</>
    );
    return (
      <>
        <h2>
          <span>
            [
            <a href={link} style="color:gray;">
              &nbsp;DL
            </a>
            {st}&nbsp;]&nbsp;
          </span>
          <span>{anime}</span>
        </h2>
        <h2 style="display: grid; grid-template-columns: 1fr .5fr .5fr .5fr; grid-column-gap: 40px; text-align: center;">
          <span>{formatBytes(size)}</span>
          <span>{String(snatch)}</span>
          <span>{String(s)}</span>
          <span>{String(l)}</span>
        </h2>
      </>
    );
  };

  // function to decode html entities in strings (e.g. &amp; -> &)
  const getDecodedString = (str) => {
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  };

  // function using GM.xmlHttpRequest to make the xmlhttprequest closer to fetch
  const GM_get = async (url) => {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: 'GET',
        url,
        headers: {
          Accept: 'application/json',
        },
        onload: (res) => {
          resolve({
            json: async () => JSON.parse(res.responseText),
          });
        },
      });
    });
  };

  const cacheSneedex = async () => {
    let res = await GM_get('https://sneedex.moe/api/public/ab');
    let data = await res.json();
    data = data
      .map((e) => e.permLinks.map((e) => e.match(/torrentid=(\d+)/)[1]))
      .flat();
    await GM_setValue('sneedexv2', data);
    return data;
  };
  let sneedex = await GM_getValue('sneedexv2', await cacheSneedex());

  const formats = {
    MANGA: 'Manga',
    NOVEL: 'Light Novel',
  };
  const createTorrentList = async (
    perfectMatch = true,
    title_type = 0,
    mal_id = null
  ) => {
    // Cleanup exising elements
    try {
      document.querySelectorAll('.animebytes').forEach((e) => e.remove());
    } catch {}
    let type = unsafeWindow.location.pathname.match(/\/(anime|manga)\/[0-9]/);
    if (type === null) {
      return;
    }
    type = type[1];
    let vueMyBeloved;
    try {
      vueMyBeloved = document
        .getElementById('app')
        .__vue__.$children.find((e) => e.media);
    } catch {
      setTimeout(createTorrentList, 500);
      return;
    }
    const containerEl = document.querySelector('.content div.overview');
    if (containerEl) {
      const types = ['romaji', 'userPreferred', 'english', 'native'];
      let seriesName;
      try {
        seriesName = vueMyBeloved.media.title[types[title_type]].replaceAll(
          /[\]\[]/g,
          ''
        );
      } catch {
        setTimeout(createTorrentList, 500);
        return;
      }
      const hentai = vueMyBeloved.media.isAdult;
      const epcount = vueMyBeloved.media.episodes ?? 'manga';
      const seriesYear =
        vueMyBeloved.media.seasonYear ?? vueMyBeloved.media.startDate?.year;
      let clonableEl = containerEl.querySelector('div .description-wrap');
      if (clonableEl === null) setTimeout(createTorrentList, 500);

      let endpoint = `https://animebytes.tv/scrape.php?torrent_pass=${passkey}&username=${username}&hentai=${Number(
        hentai
      )}&epcount=${epcount}&year=${seriesYear}&type=anime&searchstr=${encodeURIComponent(
        seriesName
      )}${
        type == 'manga'
          ? '&printedtype[' + formats[vueMyBeloved.media.format] + ']=1'
          : ''
      }`;
      if (!perfectMatch)
        endpoint = `https://animebytes.tv/scrape.php?torrent_pass=${passkey}&username=${username}&hentai=2&type=anime&searchstr=${encodeURIComponent(
          seriesName
        )}`;
      console.log(`[AnilistBytes] Using api endpoint: ${endpoint}`);
      let res = await GM_get(endpoint);
      let el = clonableEl.cloneNode(true);
      el.className = 'animebytes';
      el.querySelector('h2').style =
        'display: flex;align-content: center; text-align: center;align-items: center;';
      el.querySelector('h2').innerHTML = 'AnimeBytes';
      let inside = el.querySelector('.description');
      inside.innerText = null;
      inside.style =
        'display: grid;grid-template-columns: 1fr 0.5fr;grid-auto-columns: 1fr;';
      let title = document.createElement('h2');
      if (!mal_id) {
        mal_id = await getMALId(
          vueMyBeloved.media.id,
          vueMyBeloved.media.type,
          vueMyBeloved.media.isAdult
        );
      }
      let ab_groups = (await res.json()).Groups;
      // ab_groups[0];
      if (!ab_groups) {
        if (perfectMatch && title_type < 3) {
          console.log(
            `[AnilistBytes] Perfect match for ${
              types[title_type]
            } title failed, trying ${types[title_type + 1]} title`
          );
          return await createTorrentList(true, title_type + 1, mal_id);
        } else if (!perfectMatch && title_type < 3) {
          console.log(
            `[AnilistBytes] Imperfect match for ${
              types[title_type]
            } title failed, trying ${types[title_type + 1]} title`
          );
          return await createTorrentList(false, title_type + 1, mal_id);
        } else if (perfectMatch) {
          console.log(
            `[AnilistBytes] Perfect match for all titles failed, trying imperfect match.`
          );
          return await createTorrentList(false, 0);
        } else {
          console.log('[AnilistBytes] No match found giving up.');
          return;
        }
      }
      let data = null;
      for (let match of ab_groups) {
        if (!match.Links.MAL) {
          continue;
        }
        let mid = match.Links.MAL.match(/(\d+)/)[1];
        if (mid == mal_id) {
          data = match;
          break;
        }
      }

      console.log(data);
      if (!data && !perfectMatch) {
        data = ab_groups[0];
      } else if (!data) {
        return await createTorrentList(false, 0, mal_id);
      } else {
        perfectMatch = true;
      }

      vueMyBeloved.$children
        .find((e) => e.$options._componentTag == 'external-links')
        ._props.links.push({
          color: '#ed106a',
          site: 'AnimeBytes',
          url: `https://animebytes.tv/torrents.php?id=${data.ID}`,
          icon: 'https://anilistbytes.notmarek.com/AB.svg',
        });

      title.innerText = getDecodedString(data.FullName);
      let a = document.createElement('a');
      a.href = `https://animebytes.tv/torrents.php?id=${data.ID}`;
      a.innerText = ' [AB]';
      if (!perfectMatch) {
        a.innerText += ' (imperfect match)';
        a.title =
          "Imperfect match means that the found anime may not be what you are looking for or that year/episode count/age rating simply don't match between anilist and AB.";
      }
      a.style = 'color: grey;';
      a.target = '_blamk';
      title.appendChild(a);
      inside.appendChild(title);
      let statsHeader = document.createElement('h2');
      statsHeader.style =
        'display: grid;grid-template-columns: 1fr .5fr .5fr .5fr;grid-column-gap: 40px;text-align: center;';
      let size = document.createElement('span');
      size.innerText = 'Size';
      statsHeader.appendChild(size);
      for (const x of [
        'https://anilistbytes.notmarek.com/snatched.svg',
        'https://anilistbytes.notmarek.com/seeders.svg',
        'https://anilistbytes.notmarek.com/leechers.svg',
      ]) {
        let span = document.createElement('span');
        let img = document.createElement('img');
        img.src = x;
        span.appendChild(img);
        statsHeader.appendChild(span);
      }
      inside.appendChild(statsHeader);
      for (const torrent of data.Torrents) {
        let el = await createTorrentEntry(
          torrent.Link,
          torrent.Property,
          torrent.Size,
          torrent.Leechers,
          torrent.Seeders,
          torrent.Snatched,
          torrent.RawDownMultiplier
        );
        console.log(el);
        inside.appendChild(VM.m(el));
      }

      containerEl.insertBefore(el, clonableEl);
    } else {
      // check every 500ms if the page has loaded, so we can load our data
      setTimeout(() => createTorrentList(), 500);
    }
  };

  // hijack the window.history.pushState function to do shit for us on navigation
  (function (history) {
    var pushState = history.pushState;
    history.pushState = function (_state) {
      const res = pushState.apply(history, arguments);
      console.log(
        `[AnilistBytes] Soft navigated to ${unsafeWindow.location.pathname}`
      );
      setTimeout(createTorrentList, 500);
      return res;
    };
  })(unsafeWindow.history);

  createTorrentList();
}
