// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

// chrome.runtime.onInstalled.addListener(function() {
//   chrome.storage.sync.set({color: '#3aa757'}, function() {
//     console.log("The color is green.");
//   });
// });


let PASSPHRASE = null;
let MY_CONTEXT = null;


// Check whether new version is installed
chrome.runtime.onInstalled.addListener(function(details){
    if(details.reason == "install"){
        let manageUrl = chrome.extension.getURL("/manage/dashboard.html");
        window.open(manageUrl + "#CREATE_PASSPHRASE");

    }else if(details.reason == "update"){
        var thisVersion = chrome.runtime.getManifest().version;
        console.log("Updated from " + details.previousVersion + " to " + thisVersion + "!");
    }
});



// IPC
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {

    if( request.action == "GET_PASSPHRASE" ){
        let res = { passphrase:null };
        if( PASSPHRASE ) res.passphrase = PASSPHRASE;
        if( !PASSPHRASE && MY_CONTEXT && MY_CONTEXT.passphraseHash ) res.fail = "NOT_LOADED";
        if( !PASSPHRASE && !MY_CONTEXT.passphraseHash ) res.fail = "NOT_INITALISED";
        sendResponse(res);


    } else if( request.action == "INIT_PASSPHRASE" ){

        if( MY_CONTEXT && !MY_CONTEXT.passphraseHash ){
            let hash = hashPassphrase( request.passphrase );

            MY_CONTEXT.passphraseHash = hash;
            PASSPHRASE = request.passphrase;
            saveMyContext();
        }

        sendResponse({});

    } else if( request.action == "CHECK_PASSPHRASE" ){

        if( MY_CONTEXT && MY_CONTEXT.passphraseHash ){
            let hash = hashPassphrase( request.passphrase );
            console.log(hash);

            if( hash == MY_CONTEXT.passphraseHash ){
                PASSPHRASE = request.passphrase;
                sendResponse({success:true});
            } else {
                sendResponse({success:false});
            }
        }

    } else if( request.action == "SAVE_NEW_KEY" ){

        keychainLoadKeysByOwner( request.newKey.owner, (keys)=>{

            keys.forEach((key, i) => {
                if( key.active == true ){
                    key.active = false;
                    keychainSave( key, ()=>{
                    });
                }
            });


            request.newKey.active = true;
            keychainSave( request.newKey, ()=>{
            });

            sendResponse({success:true});
        });

    } else if( request.action == "SET_ACTIVE_KEY" ){
        // Set active key for me or recipient
        keychainLoadKeysByOwner( request.key.owner, (keys)=>{
            console.log(keys);
            keys.forEach((key, i) => {
                key.active = (request.key.uuid == key.uuid);
                keychainSave( key, ()=>{
                });
            });
            console.log(keys);

            sendResponse({success:true});
        });

    } else if( request.action == "GET_MY_ACTIVE_KEY" ){

        keychainLoadKeysByOwner( "ME", (keys)=>{
            let key = keys.find((k)=>{ return k.active; })
            sendResponse({key:key});
        });

    } else if( request.action == "GET_RECIPIENT_ACTIVE_KEY" ){

        keychainLoadKeysByOwner( request.recipient, (keys)=>{
            let key = keys.find((k)=>{ return k.active; })
            sendResponse({key:key});
        });
    } else if( request.action == "DELETE_KEY" ){
        let k = `keychain-${request.key.owner}-${request.key.uuid}`;
        chrome.storage.sync.remove([k], function() {
            sendResponse({deleted:true});
        });
    }

    return true;

});



function loadMyContext(){
    chrome.storage.sync.get(['myContext'], function(result) {
        if( result.myContext) {
            MY_CONTEXT = result.myContext;
        } else {
            // Init context
            MY_CONTEXT = {
                keySetting_nameOnKey:"",
                keySetting_myIdentitifer:"",
                createdTime: `${new Date()}`,
                version:1
            }

            saveMyContext();
        }
    });
}

setInterval( loadMyContext , 1000 );

function saveMyContext(){
    console.log("save context");
    console.log(MY_CONTEXT);
    chrome.storage.sync.set({myContext: MY_CONTEXT}, function() {
    });
}


function hashPassphrase( passphrase ){
    let hash = passphrase;
    for( let i = 0 ; i < 50; i++ ){
       hash = getHash(hash);
    }
    return hash;
}

function getHash(str){
    const myBitArray = sjcl.hash.sha256.hash(str)
    const myHash = sjcl.codec.hex.fromBits(myBitArray)
    return myHash;
}



// === KEY CHAIN FUNCTIONS ===
// Maybe move to utils in the future

function keychainLoadKeysByOwner( ownerId, callback = null ){
    chrome.storage.sync.get(null, function(items) {
        let keys = [];

        let allKeys = Object.keys(items);
        allKeys.forEach((k, i) => {
            if( k.startsWith("keychain-" + ownerId)){
                keys.push(items[k]);
            }
        });

        if(callback) callback(keys);
    });
}

function keychainLoadKey( ownerId, uuid, callback = null ){
    let k = "keychain-" + ownerId + "-" + uuid;
    chrome.storage.sync.get([k], function(items) {
        if(callback) callback(items[k]);
    });
}

function keychainSave( key , callback = null){
    let k = `keychain-${key.owner}-${key.uuid}`;
    chrome.storage.sync.set({[k]: key}, function() {
        if( callback ) callback();
    });
}
