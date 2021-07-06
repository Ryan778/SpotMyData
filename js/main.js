let authWindow, authToken; 
let audioController = new Audio(); 
audioController.volume = 0.49; 
let Interface; 

let filter = {
  showOthers: true
}

let config = {
  isUSMarket: true, 
  requestDelay: 500, 
  toastTimeout: 2000
}

function obtainToken(t) {
  authWindow = window.open(`oauth.html?type=request${t?'&force_dialog=1':''}`, '_blank'); 
}

window.oauth_callback = function(token, window) {
  window.close(); 
  if (!token) {
    alert('Failed to autenticate.');
    return; 
  }
  authToken = token; 
  fetchInitialUserInfo(); 
}

function handleError(error) {
  alert(error.message); 
}

async function fetchEndpoint(uri) {
  if (uri.slice(0, 24) === 'https://api.spotify.com/') {
    uri = uri.slice(24); //https://api.spotify.com/v1/users/wizzlersmate/playlists/1AVZz0mBuGbCEoNRQdYQju/tracks
  }
  return await fetch(`https://api.spotify.com/${uri}`, {
    'headers': {
      'Authorization': `Bearer ${authToken}`
    }
  }).then(res => {
    return res.json(); 
  });
}

async function wait(ms) {
  setTimeout(() => {
    return; 
  }, ms); 
}

async function fetchAllItems(endpoint, limit=50, callback, items=[], offset=0) {
  let data = await fetchEndpoint(`${endpoint}?offset=${offset}&limit=${limit}${config.isUSMarket?'&market=US':''}`); 
  if (data.error) {
    handleError(data.error); 
    return null; 
  }
  items.push(...data.items); 
  if (callback) {
    callback(items.length); 
  }
  if (data.next) {
    if (config.requestDelay) {
      await wait(config.requestDelay); 
    }
    return fetchAllItems(endpoint, limit, callback, items, offset + limit); 
  }
  return items; 
}

async function fetchInitialUserInfo() {
  let profile = await fetchEndpoint('v1/me'); 
  console.log(profile); 
  $('#p-name').html(`Hello, <b>${profile.display_name}</b>!`)

  let playlists = await fetchAllItems('v1/me/playlists'); 
  if (!playlists) {
    return; 
  }
  console.log(playlists); 
  playlists = playlists.map(list => {
    if (list.owner.id !== profile.id) {
      list.isOther = true; // does not belong to current user
    } 
    return list; 
  }); 

  let library = await fetchEndpoint('https://api.spotify.com/v1/me/tracks?offset=0&limit=1'); 

  playlists.unshift({
    // https://misc.scdn.co/liked-songs/liked-songs-300.png
    $sp_library: 1, 
    collaborative: false, 
    description: `Your library of saved tracks and albums.`, 
    images: [{
      url: 'https://misc.scdn.co/liked-songs/liked-songs-300.png'
    }], 
    tracks: {
      href: 'https://api.spotify.com/v1/me/tracks', 
      total: library.total
    }, 
    name: 'Liked Songs', 
    owner: profile
  }); 

  Interface = Vue.createApp(InterfaceTemplate).mount('#main'); 
  Interface.updatePlaylists(playlists); 

  $('#div-preauth').hide(); 
  $('#div-postauth').show(); 
}

function formatPlaylistTracks(tracks) {
  return tracks.map(track => {
    return {
      $external_url: track.track.external_urls.spotify, 
      added_at: track.added_at, 
      is_local: track.is_local, 
      track: {
        $album_name: track.track.album ? track.track.album.name : null, 
        name: track.track.name, 
        artists: track.track.artists, 
        uri: track.track.uri, 
        preview_url: track.track.preview_url, 
        duration_ms: track.track.duration_ms
      }
    }
  }); 
}

/**
 * Loads track details for a specific playlist
 * @param {number} index - index in playlist array to fetch
 */
async function fetchPlaylistTracks(index) {
  let playlist = Interface.playlists[index]; 
  let showIndicator = playlist.tracks.total > 100; 
  if (showIndicator) {
    Interface.pb.active = true; 
    Interface.pb.name = 'Loading tracks'; 
    Interface.pb.progress = 0; 
    Interface.pb.total = playlist.tracks.total; 
  }
  let tracks = await fetchAllItems(playlist.tracks.href, 50, (progress) => {
    if (showIndicator) {
      Interface.pb.progress = progress; 
    }
  }); 
  playlist.tracks.$trackData = formatPlaylistTracks(tracks); 
  setTimeout(() => {
    Interface.pb.active = false; 
  }, config.toastTimeout); 
  // return tracks; 
  return; 
}

const InterfaceTemplate = {
  data() {
    return {
      page: 1, 
      selectMode: false,  
      playlists: [{name: 'Hello World'}], 
      selectedPlaylist: {}, 
      currentPreviewURL: '', 
      pb: {
        active: false, 
        name: '', 
        progress: 0, 
        total: 0
      }, 
      filter, 
      config
    }
  }, 
  methods: {
    updatePlaylists(fullList) {
      for (let i = 0; i < fullList.length; i++) {
        fullList[i].$index = i; // for shownPlaylists, as it's filtered (and rendered) while this playlist is the one that's actually modified (so we need to identify which "filtered" array item ties to which "unfiltered" array item)
      }
      this.playlists = fullList; 
      console.log(this.playlists); 
    }, 
    getImageURL(list) {
      let array = list.images; 
      if (!array) {
        return 'url(https://via.placeholder.com/300x300)';
      }
      if (array.length === 1) {
        return `url(${array[0].url}`; 
      } else if (array.length > 1) {
        return `url(${array[1].url}`; 
      }
      return 'https://via.placeholder.com/300x300';
    }, 
    async selectPlaylist(index) {
      if (!this.selectMode) {
        this.selectedPlaylist = this.shownPlaylists[index]; 
        this.page = 2; 
        if (!this.selectedPlaylist.tracks.$trackData) {
          // this.pb.active = true; 
          await fetchPlaylistTracks(this.selectedPlaylist.$index); 
          if (this.selectPlaylist.$sp_library) {
            this.selectPlaylist.tracks.total = this.selectedPlaylist.tracks.$trackData.length; 
          }
        }
      }
    }, 
    decodeHTML(input) {
      var doc = new DOMParser().parseFromString(input, 'text/html');
      return doc.documentElement.textContent;
    }, 
    decodeArtists(input) {
      if (typeof input === 'string') {
        return input; 
      } else if (Array.isArray(input)) {
        return input.map(r => r.name).join(', '); 
      }
      return 'Unknown'; 
    }, 
    /**
     * Formats a duration in m:ss format
     * @param {number} input - input duration, in ms
     * @returns {string}
     */
    formatDuration(input) {
      let sec = Math.round(input/1000); 
      return `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2, '0')}`
    }, 
    /**
     * Plays a preview of a specified track (URL). 
     * @param {string} url - url of the audio preview
     * @returns {undefined}
     */
    previewTrack(url) {
      if (!url) {
        // No preview URL
        return; 
      }
      this.currentPreviewURL = url; 
      if (audioController.src === url) {
        if (audioController.paused) {
          audioController.play(); 
        } else {
          audioController.pause(); 
          this.currentPreviewURL = false; 
        }
      } else {
        audioController.src = url; 
        audioController.play(); 
      }
    }
  }, 
  computed: {
    shownPlaylists: function() {
      if (!this.playlists) {
        return []; 
      }
      let filter = this.filter; 
      return this.playlists.filter(function(list) {
        if (!filter.showOthers && list.isOther) {
          return false; 
        }
        return true; 
      }); 
    }, 
    stats: function() {
      return {
        shownTracks: this.shownPlaylists.reduce((acc, list) => {if (list.tracks && typeof list.tracks.total === 'number'){return acc + list.tracks.total}}, 0), 
        shownPlaylists: this.shownPlaylists.length, 
        totalTracks: this.playlists.reduce((acc, list) => {if (list.tracks && typeof list.tracks.total === 'number'){return acc + list.tracks.total}}, 0), 
        totalPlaylists: this.playlists.length
      }
    }
  }
}; 