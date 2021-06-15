const CLIENT_ID = '99d60b8630644b1c9d3e1647466e4d35'; 
const REDIRECT_URI = 'http://localhost:5500/oauth.html'; 
const PARAMS = new URLSearchParams(location.search);

function throwError(msg) {
  // alert(msg); 
  let p = document.getElementById('status'); 
  p.classList.add('error');
  p.innerHTML = `<b>Error: </b>`; 
  p.insertAdjacentText('beforeend', msg); 
  document.getElementById('error-det').style.display = 'block'; 
}

function obtainStatus() {
  if (!window.opener) {
    throwError('Invalid request state.');
    return; 
  }
  
  if (PARAMS.get('type') === 'request') {
    window.open(`https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURI(REDIRECT_URI)}&scope=user-library-read%20user-library-modify%20playlist-read-private%20playlist-read-collaborative%20playlist-modify-public%20playlist-modify-private&show_dialog=${PARAMS.get('force_dialog') === '1' ? 'true':'false'}`, '_self'); 
  } else if (PARAMS.get('error') !== null) {
    // window.opener.oauth_callback(false, window);
    throwError('You did not grant permission for SpotMyData to access your Spotify data.');
  }
  
  const HASH = new URLSearchParams(location.hash.slice(1)); 
  if (HASH.get('access_token') !== null) {
    // Token received
    window.opener.oauth_callback(HASH.get('access_token'), window);
  }
}

window.onload = obtainStatus; 