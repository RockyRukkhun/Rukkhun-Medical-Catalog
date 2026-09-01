/* Rukkhun Medical Catalog — tiny GitHub Contents API client
   Used only by admin.html. Talks directly to api.github.com from the browser
   using a fine-grained Personal Access Token the user pastes in and that is
   stored only in this browser's localStorage. Never sent anywhere else. */

var GH = (function(){
  'use strict';

  var API = 'https://api.github.com';

  function utf8ToBase64(str){
    var bytes = new TextEncoder().encode(str);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  function base64ToUtf8(b64){
    var binary = atob(String(b64).replace(/\n/g, ''));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function headers(token){
    return {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  function request(method, url, token, body){
    var opts = { method: method, headers: headers(token) };
    if (body !== undefined){
      opts.headers = Object.assign({}, opts.headers, { 'Content-Type': 'application/json' });
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(function(res){
      return res.text().then(function(text){
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch(e){ data = null; }
        if (!res.ok){
          var err = new Error((data && data.message) ? data.message : ('GitHub API error ' + res.status));
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  /* Verify the token can see this repo (used by the "test connection" button). */
  function testRepo(owner, repo, token){
    return request('GET', API + '/repos/' + owner + '/' + repo, token);
  }

  /* Read a JSON file. Resolves { json, sha } or { json: fallback, sha: null } if the file
     doesn't exist yet (first run). Throws on any other error (bad token, no access, etc). */
  function getJson(owner, repo, path, token, fallback){
    var url = API + '/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(path).replace(/%2F/g,'/');
    return request('GET', url, token).then(function(data){
      var text = base64ToUtf8(data.content);
      return { json: JSON.parse(text), sha: data.sha };
    }).catch(function(err){
      if (err.status === 404) return { json: fallback, sha: null };
      throw err;
    });
  }

  /* Write a JSON file. Pass the sha you last read (or null to create a new file). */
  function putJson(owner, repo, path, obj, sha, token, message){
    var url = API + '/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(path).replace(/%2F/g,'/');
    var body = {
      message: message || ('update ' + path),
      content: utf8ToBase64(JSON.stringify(obj, null, 2))
    };
    if (sha) body.sha = sha;
    return request('PUT', url, token, body).then(function(res){
      return { sha: res.content && res.content.sha };
    });
  }

  /* Write a binary/base64 file (images). dataUrl is a full "data:image/jpeg;base64,...." string.
     Pass the current sha only if you know you're overwriting an existing path with the same name. */
  function putImage(owner, repo, path, dataUrl, token, message){
    var url = API + '/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(path).replace(/%2F/g,'/');
    var base64 = String(dataUrl).replace(/^data:[^;]+;base64,/, '');
    var body = { message: message || ('add ' + path), content: base64 };
    return request('PUT', url, token, body).then(function(res){
      return { sha: res.content && res.content.sha };
    });
  }

  return { testRepo: testRepo, getJson: getJson, putJson: putJson, putImage: putImage };
})();
