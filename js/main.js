let authWindow, authToken = 'BQA_ZP1vMaCNlcwo4Vng5jwNGzZwBit9hUL3xjzFxuEa7xgGSlWUG5ofhd6dw6Lltvj4cmg-l_8RXQRJCrpWVkWQbaHKVHVwD1m5J8FQ9o_9iPh5ZOnLMMr8Z11Dt3X9VCzcFMsjaRGoJff0ZFTIKJ8YucEjt8ikdGzGYp1ElXwnxZyi1XoXWfVQ9nakKFqYI62U8S_5vVjBCIF6iNc'; 
let audioController = new Audio(); 
let Interface; 

let filter = {
  showOthers: false
}

let config = {
  isUSMarket: true
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

async function fetchAllItems(endpoint, limit=50, items=[], offset=0) {
  let data = await fetchEndpoint(`${endpoint}?offset=${offset}&limit=${limit}${config.isUSMarket?'&market=US':''}`); 
  if (data.error) {
    handleError(data.error); 
    return null; 
  }
  items.push(...data.items); 
  if (data.next) {
    return fetchAllItems(endpoint, limit, items, offset + limit); 
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
  })

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
  })
}

/**
 * Loads track details for a specific playlist
 * @param {number} index - index in playlist array to fetch
 */
async function fetchPlaylistTracks(index) {
  let playlist = Interface.playlists[index]; 
  let tracks = await fetchAllItems(playlist.tracks.href, 100); 
  playlist.tracks.$trackData = formatPlaylistTracks(tracks); 
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
      currentPreviewURL: ''
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
    selectPlaylist(index) {
      if (!this.selectMode) {
        this.selectedPlaylist = this.shownPlaylists[index]; 
        if (!this.selectedPlaylist.tracks.$trackData) {
          fetchPlaylistTracks(this.selectedPlaylist.$index); 
        }
        this.page = 2; 
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

// BQD9evMBSrv4pKS38rmOiUb-NH84mecQj1XzVLDmsU6hekGTUn3hjiJPHT_0W2JdAYu2jQdkuREzcIyKwt7fPyhH5gwkzdyBWm_X3IV2LdofzXh2JY3nNA8WX_SImiTx5v0RpKu14NYWxHlkz-z1HE7qM5QUCL1mD8TMDrrXn0eItExtk8T7i0tNu_ATUkIeFlSyGjqcjgmF-qPI-08