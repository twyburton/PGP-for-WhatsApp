// https://github.com/openpgpjs/openpgpjs/blob/master/README.md#getting-started


const MANIFEST_DATA = chrome.runtime.getManifest();

const VERBOSE_LOGGING = true;

const READ_PAGE_INTERVAL = 500; //ms


// ===== PAGE ELEMENTS =====
const WHATSAPP_SEND_BUTTON = "button._2Ujuu";
const WHATSAPP_READ_MORE_BUTTON = "._2kMJX";
const WHATSAPP_MESSAGE_CONTAINER = "._1VzZY span";


let MY_CONTEXT = null;
let MY_KEY_UUID = null;
let MY_KEY = null;
let ACTIVE_RECIPIENT_KEY = null;
let currentRecipient = null;

let SINGLE_PASSPHRASE_REQUEST = true;

// ===== Read Page Loop =====
function readPage() {

    // Get recipient details
    let recipientId = getUID();
    let myId = getMyID();

    let profilePictureWarning = document.getElementById("profile-picture-warning");
    if( recipientId.defaultUser ){
        if(profilePictureWarning) profilePictureWarning.style.display = "block";
    } else {
        if(profilePictureWarning) profilePictureWarning.style.display = "none";
    }

    if( recipientId != currentRecipient) initUI();

    if( isCoreUILoaded() ) {

        if( recipientId != currentRecipient){
            if( recipientId.userFound && recipientId.isGroup == false && myId.meFound ){
                keychainLoadKeysByOwner( recipientId.id, (keys)=>{

                    let key = keys.find((k)=>{ return k.active == true; });
                    if( key ){
                        ACTIVE_RECIPIENT_KEY = key;
                        document.getElementById("pgp-recipient-fingerprint").innerText = ACTIVE_RECIPIENT_KEY.fingerprint.toUpperCase();
                    } else {
                        ACTIVE_RECIPIENT_KEY = null;
                    }

                });
            } else {
                ACTIVE_RECIPIENT_KEY = null;
            }

            // Display error if group
            if ( recipientId.userFound && recipientId.isGroup ){
                document.getElementById("pgp-group").style.display = "block";
            } else {
                document.getElementById("pgp-group").style.display = "none";
            }

        }
        currentRecipient = recipientId;





        // Process messages
        var messagesOut = document.querySelectorAll(".message-out:not(.pgp-processing)");
        var messagesIn = document.querySelectorAll(".message-in:not(.pgp-processing)");

        messagesOut.forEach((msg, i) => {
            let container = msg.querySelector(WHATSAPP_MESSAGE_CONTAINER);
            if( container ){
                msg.classList.add("pgp-processing");
                let text = container.innerText;

                if( text.startsWith("-----BEGIN PGP PUBLIC KEY BLOCK-----")){

                    waitForReadMore( msg, ( fullText, container )=>{

                        text = fullText;

                        let fillerUUID = generateUUID();
                        container.innerHTML = `<div class='pgp-control-text'>
                                    <div>You shared a key</div>
                                    <div id="${fillerUUID}"></div>
                                </div>`;
                        msg.classList.add("pgp-modified");
                        msg.classList.add("pgp-modified-control");

                        getPubFingerprint(text,(fp)=>{
                            document.getElementById(fillerUUID).innerText = fp;
                        });

                    });

                } else if ( text.startsWith("-----BEGIN PGP MESSAGE-----")){

                    decryptMessage(msg);

                }
            }
        });

        messagesIn.forEach((msg, i) => {
            let container = msg.querySelector(WHATSAPP_MESSAGE_CONTAINER);
            if( container ){
                msg.classList.add("pgp-processing");
                let text = container.innerText;

                // READ KEY
                if( text.startsWith("-----BEGIN PGP PUBLIC KEY BLOCK-----")){

                    waitForReadMore( msg, ( fullText, container )=>{

                        text = fullText;

                        // Load Key
                        openpgp.key.readArmored(text).then((openkey)=>{
                            if( openkey.keys.length == 1 ){
                                openkey = openkey.keys[0];
                                console.log(openkey);

                                let fingerprint = openkey.primaryKey.fingerprint;
                                let fp = "";
                                fingerprint.forEach((n, i) => {
                                    let num = n.toString(16)
                                    fp += ( num.length == 1 ? "0":"") + num;
                                    if( i%2 == 1 ) fp += " ";
                                });

                                let newKey = {
                                    uuid:generateUUID(),
                                    name:"Newly Received Key",
                                    owner: recipientId.id, // PHONE CODE
                                    pub: text,
                                    created: `${openkey.primaryKey.created}`,
                                    saved:`${new Date()}`,
                                    fingerprint:fp,
                                }

                                console.log(newKey);

                                keychainLoadKeysByOwner( recipientId.id, (keys)=>{
                                    let found = false;
                                    keys.forEach((key, i) => {
                                        if( key.fingerprint == newKey.fingerprint ){
                                            found = true;
                                        }
                                    });

                                    if( found ){
                                        let fillerUUID = generateUUID();
                                        container.innerHTML = `<div class='pgp-control-text'>
                                                                    <div>This key is already saved</div>
                                                                    <div id="${fillerUUID}"></div>
                                                                </div>`;
                                        msg.classList.add("pgp-modified");
                                        msg.classList.add("pgp-modified-control");

                                        getPubFingerprint(text,(fp)=>{
                                            document.getElementById(fillerUUID).innerText = fp;
                                        });

                                    } else {
                                        let actionUUID = generateUUID();
                                        container.innerHTML = `
                                            A new key has been sent. Fingerprint: ${fp}.<br/>
                                            Would you like to save it?<br/>
                                            <a class='pgp-action' id='pgp-action-save-key-${actionUUID}-yes'>Yes</a><a class='pgp-action' id='pgp-action-save-key-${actionUUID}-no'>No</a>
                                        `;
                                        msg.classList.add("pgp-modified");
                                        msg.classList.add("pgp-modified-control");

                                        document.getElementById(`pgp-action-save-key-${actionUUID}-yes`).addEventListener("click",()=>{
                                            //keychainSave( newKey );

                                            let request = { action:"SAVE_NEW_KEY", newKey: newKey }
                                            chrome.runtime.sendMessage( request, function(res) {
                                                console.log(res);

                                            });

                                            container.innerHTML = `
                                                    <div class='pgp-control-text'>Key Saved</div>
                                                    <div class='pgp-control-text'>Fingerprint: ${fp}</div>
                                                `;
                                        });

                                        document.getElementById(`pgp-action-save-key-${actionUUID}-no`).addEventListener("click",()=>{
                                            container.innerHTML = "<div class='pgp-control-text'>Key not saved</div>"
                                        });
                                    }
                                });


                            } else {
                                // Error with reading key
                            }

                        });
                    });

                } else if ( text.startsWith("-----BEGIN PGP MESSAGE-----")){
                    decryptMessage(msg);
                }

            }
        });

    }

    setTimeout(readPage,READ_PAGE_INTERVAL);
}

readPage();



// ==== Refresh my Context ====
setInterval(()=>{
    loadMyContext(()=>{

        keychainLoadKey( "ME", MY_CONTEXT.defaultKey, (key)=>{

            MY_KEY = key;

            // Load Key
            getPubFingerprint(MY_KEY.pub, (fingerprint)=>{
                let myfp = document.getElementById("pgp-my-fingerprint");
                if( myfp && myfp.innerText != fingerprint ){
                     myfp.innerText = fingerprint;
                     MY_KEY_UUID = MY_CONTEXT.defaultKey;
                }
            });

        });

    });
},1000);



function isCoreUILoaded(){
    return document.getElementById("pgp-core-ui") != null;
}

// Check if UI is loaded and load if not
function initUI(){

    if( document.getElementById("main") != null ){
        if( !isCoreUILoaded() ){
            const url = chrome.runtime.getURL('pages/coreui.html');
            fetch(url).then(function(response) {
                response.text().then(function(result){
                    var coreUiHtml = result;

                    var elem = document.createElement('div');
                    elem.id = "pgp-core-ui";
                    elem.innerHTML = coreUiHtml;
                    document.getElementById("main").appendChild(elem);

                    document.getElementById("pgp-action-share-key").addEventListener( "click", ()=>{
                        if( MY_KEY ){
                            sendMessage(MY_KEY.pub);
                        }
                    });

                    let manageUrl = chrome.extension.getURL("/manage/dashboard.html");
                    document.getElementById("action-manage-keys").href= manageUrl;
                });
            });



            let action = document.createElement("div");
            action.classList.add("pgp-encrypt-action");
            action.innerHTML = `
                <a class='action-encrypt' id="action-encrypt-and-send">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-lock-fill" viewBox="0 0 16 16"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>
                </a>
            `;

            let messageBox = document.querySelector("._3SvgF._1mHgA");
            messageBox.appendChild(action);


            document.getElementById("action-encrypt-and-send").addEventListener( "click", encryptAndSend );
        }
    }


}


// Fetch the text in the message text box, encrypt and send to recipient.
function encryptAndSend(){

    if( MY_KEY && ACTIVE_RECIPIENT_KEY ){

        let request = { action:"GET_PASSPHRASE" }
        chrome.runtime.sendMessage( request, function(res) {
            console.log(res);
            if( res.passphrase == null ){
                let manageUrl = chrome.extension.getURL("/manage/dashboard.html");
                if( res.fail == "NOT_INITALISED" && SINGLE_PASSPHRASE_REQUEST ) window.open(manageUrl + "#CREATE_PASSPHRASE");
                //selectPage("CREATE_PASSPHRASE");
                else if ( res.fail == "NOT_LOADED" && SINGLE_PASSPHRASE_REQUEST ) window.open(manageUrl + "#GET_PASSPHRASE");
                //selectPage("GET_PASSPHRASE");

                SINGLE_PASSPHRASE_REQUEST = false;


            } else {

                let msg = getTypedMessage();
                if( msg != ""){

                    (async () => {

                        // Public Keys
                        let publicKeysArmored = [];
                        publicKeysArmored.push(MY_KEY.pub);
                        publicKeysArmored.push(ACTIVE_RECIPIENT_KEY.pub);

                        // Open
                        const publicKeys = await Promise.all(publicKeysArmored.map(async (key) => {
                            return (await openpgp.key.readArmored(key)).keys[0];
                        }));

                        // Private key
                        let privateKey = (await openpgp.key.readArmored(MY_KEY.priv)).keys[0];
                        privateKey.decrypt(res.passphrase).then(()=>{


                            // Encrypt
                            // const { data: encrypted } = await openpgp.encrypt({
                            //     message: openpgp.message.fromText(msg),                 // input as Message object
                            //     publicKeys, // for encryption
                            //     privateKeys: [privateKey];
                            // });

                            // Encrypt
                            openpgp.encrypt({
                                message: openpgp.message.fromText(msg),                 // input as Message object
                                publicKeys, // for encryption
                                privateKeys: [privateKey]
                            }).then((data)=>{
                                sendMessage(data.data);
                            });



                        });


                    })();
                }

            }
        });

    }

}



// ===========================================
//                  UTILITIES
// ===========================================

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




function sendMessage(text){
    // OLD: https://stackoverflow.com/questions/47243154/how-to-send-whatsapp-message-via-javascript
    // NEW METHOD: https://medium.com/swlh/how-to-build-a-chrome-extension-to-spam-on-whatsapp-using-vanilla-javascript-1c00faa6a2f7

    // Copy
    var el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style = {position: 'absolute', left: '-9999px'};
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);

    // Paste
    let e = document.createEvent("UIEvents");
    let textbox = document.querySelectorAll("[contenteditable='true']")[1];
    textbox.innerText = text;
    e.initUIEvent("input", true, true, window, 1);
    textbox.dispatchEvent(e);

    // Send
    document.querySelector(WHATSAPP_SEND_BUTTON).click();
    console.log("Message Sent");
}


// Get text from message text box
function getTypedMessage(){
    let textbox = document.querySelectorAll("[contenteditable='true']")[1];
    if( textbox ){
        return textbox.innerHTML;
    }
    return "";
}



// Get the user ID of the chat from the profile image
function getUID(){

    let image = document.querySelector("._1UuMR ._1VzZY");
    if( image ){
        let url_string = image.getAttribute("src");
        if( url_string ){
            let url = new URL(url_string);
            let uid = url.searchParams.get("u");

            // Individual: 447753361184@c.us
            // Group: 447753361184-1576063861@g.us

            let uidSplit = uid.split("@");
            let isGroup = false;
            if( uidSplit[1] == "g.us") isGroup = true;

            return {userFound:true,id:uid,isGroup:isGroup};
        }
    }


    let defaultUser = document.querySelector("#main span[data-testid=default-user]");
    if( defaultUser ) return {userFound:false, defaultUser:true};

    return {userFound:false};



}


function getMyID(){

    let image = document.querySelector("._2O84H ._1VzZY");
    if( image ){
        let url_string = image.getAttribute("src");
        let url = new URL(url_string);
        let uid = url.searchParams.get("u");

        // Individual: 447753361184@c.us
        // Group: 447753361184-1576063861@g.us

        let uidSplit = uid.split("@");
        let isGroup = false;
        if( uidSplit[1] == "g.us") isGroup = true;

        return {meFound:true,id:uid,isGroup:isGroup};

    } else {
        return {meFound:false};
    }


}


function generateUUID() { // Public Domain/MIT
    var d = new Date().getTime();//Timestamp
    var d2 = (performance && performance.now && (performance.now()*1000)) || 0;//Time in microseconds since page-load or 0 if unsupported
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16;//random number between 0 and 16
        if(d > 0){//Use timestamp until depleted
            r = (d + r)%16 | 0;
            d = Math.floor(d/16);
        } else {//Use microseconds since page-load if supported
            r = (d2 + r)%16 | 0;
            d2 = Math.floor(d2/16);
        }
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}




function loadMyContext( callback ){
    chrome.storage.sync.get(['myContext'], function(result) {
        if( result.myContext) {
            MY_CONTEXT = result.myContext;
        }

        if( callback ) callback();
    });
}


/*
    Function to get full message.
    Some messages may be so long that the read more button may need to be clicked
*/
function waitForReadMore( msg , callback ){
    // Click readmore button
    let readMore = msg.querySelector(WHATSAPP_READ_MORE_BUTTON);
    if( readMore ) readMore.click();

    // Wait for readmore button to go away
    let inter = setInterval( ()=>{
        let readMore = msg.querySelector(WHATSAPP_READ_MORE_BUTTON);
        if( !readMore ){

            let container = msg.querySelector("._1VzZY span");

            clearInterval(inter);
            callback(container.innerText, container);
        }
    },20);
}

function decryptMessage( msg ){

    // let readMore = msg.querySelector("._2kMJX");
    // if( readMore ) readMore.click();

    waitForReadMore( msg, ()=>{

        let container = msg.querySelector(WHATSAPP_MESSAGE_CONTAINER);
        let text = container.innerText;


        keychainLoadKeysByOwner("ME",(keys)=>{

            // Fetch passphrase
            let request = { action:"GET_PASSPHRASE" }
            chrome.runtime.sendMessage( request, function(res) {
                if( res.passphrase == null ){
                    let manageUrl = chrome.extension.getURL("/manage/dashboard.html");
                    if( res.fail == "NOT_INITALISED" && SINGLE_PASSPHRASE_REQUEST ) window.open(manageUrl + "#CREATE_PASSPHRASE");
                    //selectPage("CREATE_PASSPHRASE");
                    else if ( res.fail == "NOT_LOADED" && SINGLE_PASSPHRASE_REQUEST ) window.open(manageUrl + "#GET_PASSPHRASE");
                    //selectPage("GET_PASSPHRASE");

                    SINGLE_PASSPHRASE_REQUEST = false;

                    msg.classList.remove("pgp-processing");

                } else {

                    let passphrase = res.passphrase;

                    // DECRYPT AND VERIFY MESSAGE

                    // Get my private keys for decryption
                    let privArmored = [];
                    // Get all my public and recipient public keys for verification
                    let publicKeysArmored = [];

                    // get my keys
                    keys.forEach((k, i) => {
                        privArmored.push(k.priv);
                        publicKeysArmored.push(k.pub);
                    });
                    // Get recipients keys
                    keychainLoadKeysByOwner(currentRecipient.id,(recipientKeys)=>{
                        recipientKeys.forEach((k, i) => {
                            publicKeysArmored.push(k.pub);
                        });

                        (async () => {
                            // Load private keys
                            const privateKeys = await Promise.all(privArmored.map(async (key) => {
                                return (await openpgp.key.readArmored(key)).keys[0];
                            }));
                            // Load public keys
                            const publicKeys = await Promise.all(publicKeysArmored.map(async (key) => {
                                return (await openpgp.key.readArmored(key)).keys[0];
                            }));


                            // Decrypt
                            let keysToDecrypt = privateKeys.length;
                            privateKeys.forEach((k, i) => {

                                k.decrypt(passphrase).then(()=>{
                                    keysToDecrypt--;

                                    // Once all keys decrypted then decrypt messages
                                    if( keysToDecrypt == 0 ){

                                        (async () => {

                                            openpgp.decrypt({
                                                message: await openpgp.message.readArmored(text),              // parse armored message
                                                publicKeys: publicKeys, // for verification (optional)
                                                privateKeys: privateKeys // for decryption
                                            }).then((decrypted)=>{

                                                openpgp.stream.readToEnd(decrypted.data).then((plaintext)=>{

                                                    let sigs = decrypted.signatures;
                                                    let nSigs = sigs.length;
                                                    if( nSigs > 0 ){
                                                        let str = "";
                                                        sigs.forEach((sig, i) => {

                                                            let verified = false;
                                                            if( sig.valid ){
                                                                verified = true;
                                                            }

                                                            // Get signature owner
                                                            let keyid = getKeyId(sig.keyid);

                                                            keychainLoadKeyById(keyid).then((owner,err)=>{
                                                                if( (owner == currentRecipient.id || owner == "ME") && verified){
                                                                    str += `<div class='sig'>
                                                                                <div>Message Signature Verified</div>
                                                                                <div>Signed @ ${convertDatetime(sig.signature.packets[0].created)}</div>
                                                                            </div>`;
                                                                } else if( owner == currentRecipient.id || owner == "ME" ){
                                                                    str += `<div class='sig'>Signature Invalid</div>`;
                                                                } else {
                                                                    str += `<div class='sig'>
                                                                                <div>Message from: ${owner} ${(verified? "Valid" : "Not Valid")}</div>
                                                                                <div>Signed @ ${convertDatetime(sig.signature.packets[0].created)}</div>
                                                                            </div>`;
                                                                }

                                                            }).catch((err)=>{
                                                                console.log(err);
                                                                str += `<div class='sig'>
                                                                            Signer Unknown [${keyid}]
                                                                        </div>`;

                                                            }).finally(()=>{
                                                                nSigs--;

                                                                if( nSigs == 0 ){
                                                                    str += `<div class='pgp-message'>${plaintext}</div>`;
                                                                    container.innerHTML = `<div>${str}</div>`;
                                                                    msg.classList.add("pgp-modified");

                                                                    console.log(decrypted);
                                                                }
                                                            });


                                                        });

                                                    } else {
                                                        let str = "";
                                                        str += `<div class='sig'>No Signatures Attached</div>`;
                                                        str += `<div class='pgp-message'>${plaintext}</div>`;
                                                        container.innerHTML = `<div>${str}</div>`;
                                                        msg.classList.add("pgp-modified");

                                                        console.log(decrypted);
                                                    }

                                                });



                                            }).catch((err)=>{
                                                console.log(err);
                                                container.innerText = "ERROR DECRYPTING MESSAGE";
                                                msg.classList.add("pgp-modified");
                                            });

                                        })();
                                    }
                                });
                            });
                        })();

                    });


                }

            });



        });
    },100);
}
