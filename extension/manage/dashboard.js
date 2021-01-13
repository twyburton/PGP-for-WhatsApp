
let MY_CONTEXT = null;


PAGE_DATA = {

     HOME : {
         content: `<h1>Home</h1>

            <p>
                Thanks for using PGP for Whatsapp.
            </p>
            <p>
                This is currently in beta and may have some issues.
                Please use the support page on the chrome webstore to report issue or request features.
            </p>


         `,
     },
     SETTINGS : {
         content: `<h1>Settings</h1>

            <h2>My Key Settings</h2>

            <table class='key-value'>
                <tr>
                    <td>Name on Key</td><td><input id="key-settings-name-on-key" type="text" placeholder="e.g. John Smith"></td>
                </tr>
                <tr>
                    <td>My Identifier</td><td><input id="key-settings-my-identifier" type="text" placeholder="i.e. Email or Phone Number (Can be left blank)"></td>
                </tr>
            </table>

            <a class='action' id='action-save-key-settings'>Save Key Settings</a> <span id='action-success-saved'></span>

         `,
         postFunc: ()=>{
            document.getElementById("key-settings-name-on-key").value = MY_CONTEXT.keySetting_nameOnKey;
            document.getElementById("key-settings-my-identifier").value = MY_CONTEXT.keySetting_myIdentitifer;
         },
         clickListeners: [
             {
                 id:"action-save-key-settings",
                 func: ()=>{
                    let nameOnKey = document.getElementById("key-settings-name-on-key").value;
                    let myIdentifier = document.getElementById("key-settings-my-identifier").value;

                    loadMyContext( ()=>{
                        MY_CONTEXT.keySetting_nameOnKey = nameOnKey;
                        MY_CONTEXT.keySetting_myIdentitifer = myIdentifier;

                        saveMyContext(()=>{
                            document.getElementById("action-success-saved").innerHTML = `Saved <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check2" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>`;
                        });
                    });

                 }
             }
         ]
     },
     CREATE_PASSPHRASE: {
          content: `<h1>Create Passphrase</h1>

            <p>A Passphrase is used to protect your private keys when stored.</p>

            <p>If you lose your passphrase you will lose access to your keys and messages.</p>

             <table class='key-value'>
                 <tr>
                     <td>Passphrase</td><td><input type="password" id="passphrase-new"></td>
                 </tr>
                 <tr>
                     <td>Retype Passphrase</td><td> <input type="password" id="passphrase-new-2"></td>
                 </tr>
             </table>
             <a class='action' id='action-passphrase'>Save</a>
          `,
          clickListeners: [
              {
                  id:"action-passphrase",
                  func: ()=>{
                      let newPassphrase0 = document.getElementById("passphrase-new").value;
                      let newPassphrase1 = document.getElementById("passphrase-new-2").value;

                      if( newPassphrase0 != "" && newPassphrase0 == newPassphrase1 ){

                          let request = { action: "INIT_PASSPHRASE" , passphrase: newPassphrase0 };
                          chrome.runtime.sendMessage( request, function(res) {
                          });

                          //selectPage("KEY_MANAGEMENT");
                          window.location = "/manage/dashboard.html";

                      }
                  }
              }
          ]
     },
     GET_PASSPHRASE: {
         content: `<h1>Unlock Passphrase</h1>
            <table class='key-value'>
                <tr>
                    <td>Passphrase</td><td><input type="password" id="passphrase"></td>
                </tr>
            </table>
            <a class='action' id='action-passphrase'>Unlock</a>
         `,
         clickListeners: [
             {
                 id:"action-passphrase",
                 func: ()=>{
                     let newPassphrase0 = document.getElementById("passphrase").value;

                     let request = { action: "CHECK_PASSPHRASE" , passphrase: newPassphrase0 };
                     chrome.runtime.sendMessage( request, function(res) {
                         if( res.success == true ){
                             //selectPage("KEY_MANAGEMENT");
                             window.location = "/manage/dashboard.html";
                         } else {
                             document.getElementById("passphrase").value = null;
                             document.getElementById("passphrase").style.border = "1px solid var(--red)";
                         }

                     });

                 }
             }
         ]
     },
     KEY_MANAGEMENT: {
         content: `
         <h1>Key Managment</h1>

         <div>
             <a class='action' id='action-new-key'>Generate New Key</a>
             <a class='action' id='action-import-key'>Import Key</a>
             <a class='action' id='action-export-key'>Export Keychain</a>
         </div>

         <div class='hidden form' id='form-new-key'>
            Key passphrase <input type="password" id='form-new-key-passphrase'">
            <a class='action' id='action-form-new-key-generate'>Generate</a>
         </div>

         <h2>Keys</h2>


         <table class="generic">

             <tr>
                 <th></th><th>Name</th><th>Key ID</th><th>Fingerprint</th><th>Created</th><th></th>
             </tr>

             <tbody id="key-management-body">

             </tbody>

         </table>`,

         postFunc: ()=>{


             // Populate Key list
             keychainLoadFull((keys)=>{
                console.log(keys);

                document.getElementById("key-management-body").innerHTML = "";

                let owners = Array.from(new Set(keys.map((item) => item.owner)));
                owners.sort((a,b)=>{return b-a;});

                owners.forEach((owner, i) => {
                    let keysByOwner = keys.filter((k)=>{ return k.owner == owner; });

                    let str = "";

                    str += `
                                <tr class='highlight'>
                                    <td></td>
                                    <td>${owner}</td>
                                    <td></td>
                                    <td></td>
                                    <td>${keysByOwner.length} Keys</td>
                                    <td></td>
                                </tr>
                            `;

                    keysByOwner.sort((a,b)=>{
                        return new Date(b.saved) - new Date(a.saved);
                    });

                    keysByOwner.forEach((key, i) => {
                        str += `
                                    <tr>
                                        <td>${( key.active ? "<span class='active'>Active</span>" : "")}</td>
                                        <td>${key.name}</td>
                                        <td class='mono' id='key-${key.uuid}-id'></td>
                                        <td class='mono' id='key-${key.uuid}-fingerprint'></td>
                                        <td>${convertDate(new Date(key.created))}</td>
                                        <td>
                                            <a id='key-${key.uuid}-action-edit' class='action-mini' title='Edit key'><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456l-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg></a>
                                             <a id='key-${key.uuid}-action-clipboard' class='action-mini' title='Copy public key to clipboard'><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-key-fill" viewBox="0 0 16 16"><path d="M3.5 11.5a3.5 3.5 0 1 1 3.163-5H14L15.5 8 14 9.5l-1-1-1 1-1-1-1 1-1-1-1 1H6.663a3.5 3.5 0 0 1-3.163 2zM2.5 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg></a>
                                        </td>
                                    </tr>
                                `;
                    });

                    document.getElementById("key-management-body").innerHTML += str;

                });

                keys.forEach((key, i) => {

                    document.getElementById(`key-${key.uuid}-action-clipboard`).addEventListener("click",()=>{
                        copyToClipboard(key.pub);
                    });

                    let fingerprint = null;
                    let keyid = null;

                    // Edit key event listener
                    document.getElementById(`key-${key.uuid}-action-edit`).addEventListener("click",()=>{

                        popupSetText(`
                                <div class='segment popup-title'>Edit Key</div>

                                <table class='key-value auto-size'>
                                    <tr>
                                        <td>Key ID</td>
                                        <td><input type="text" value="${keyid}" readonly></td>
                                    </tr>
                                    <tr>
                                        <td>Fingerprint</td>
                                        <td><input type="text" value="${fingerprint}" readonly></td>
                                    </tr>
                                    <tr>
                                        <td>Name</td>
                                        <td><input type="text" id="popup-input-key-name" value="${key.name}"></td>
                                    </tr>

                                    <tr>
                                        <td>Created</td>
                                        <td>${key.created}</td>
                                    </tr>

                                    <tr>
                                        <td>Saved</td>
                                        <td>${key.saved}</td>
                                    </tr>
                                    <tr>
                                        <td></td>
                                        <td>${(key.active? "<span class='active'>Active</span>" : "" )}</td>
                                    </tr>
                                    <tr>
                                        <td></td>
                                        <td>${(!key.active? "<span class='active action' id='action-set-key-active'>Make Active Key</span> <span class='active action' id='action-key-delete'>Delete Key</span>":"")}</td>
                                    </tr>
                                </table>

                                <div class='segment warning' id='delete-warning' style='display:none'>
                                    <div>Are you sure you wish to delete this key? Once deleted it cannot be undone unless you have a backup of your key or get your recipient to send another copy.</div>
                                    <div class='segment actions'>
                                        <a id='key-delete-yes' class='action'>Delete</a>
                                        <a id='key-delete-no' class='action'>Cancel</a>
                                    </div>
                                </div>

                                <div class='segment actions'><a id='popup-update-key' class='action'>Save</a> <a id='popup-close' class='action'>Close</a></div>
                            `);

                        document.getElementById("popup-close").addEventListener("click",()=>{ popupDisplay(false); });
                        document.getElementById("popup-update-key").addEventListener("click",()=>{
                            key.name = document.getElementById("popup-input-key-name").value;
                            keychainSave( key );
                            popupDisplay(false);
                            selectPage("KEY_MANAGEMENT");
                        });

                        let setActiveKeyButton = document.getElementById("action-set-key-active");
                        if( setActiveKeyButton ){
                            // Set active key
                            setActiveKeyButton.addEventListener("click",()=>{
                                let request = { action:"SET_ACTIVE_KEY", key:key };
                                chrome.runtime.sendMessage( request, function(res) {
                                    popupDisplay(false);
                                    selectPage("KEY_MANAGEMENT");
                                });
                            });

                            // Delete key
                            document.getElementById("action-key-delete").addEventListener("click",()=>{
                                document.getElementById("delete-warning").style.display = "block";

                                // Cancel Delete
                                document.getElementById("key-delete-no").addEventListener("click",()=>{
                                    document.getElementById("delete-warning").style.display = "none";

                                });

                                // Confirm Delete
                                document.getElementById("key-delete-yes").addEventListener("click",()=>{
                                    document.getElementById("delete-warning").style.display = "none";

                                    let request = { action:"DELETE_KEY", key:key };
                                    chrome.runtime.sendMessage( request, function(res) {
                                        popupDisplay(false);
                                        selectPage("KEY_MANAGEMENT");
                                    });

                                });
                            });




                        }

                        popupDisplay(true);

                    });

                    getPubFingerprint( key.pub , (fp)=>{
                        fingerprint = fp;
                        let fpLocation = document.getElementById("key-" + key.uuid + "-fingerprint");
                        if( fpLocation ) fpLocation.innerHTML = fingerprint;
                    });

                    getPubId( key.pub, (kid)=>{
                        keyid = kid;
                        let idLocation = document.getElementById("key-" + key.uuid + "-id");
                        if( idLocation ) idLocation.innerHTML = keyid.toUpperCase();
                    });

                });



             });
         },

         clickListeners: [
             {
                 id:"action-new-key",
                 func: ()=>{

                     //document.getElementById("form-new-key").style.display="block";

                     let request = { action:"GET_PASSPHRASE" }
                     chrome.runtime.sendMessage( request, function(res) {
                         console.log(res);
                         if( res.passphrase == null ){
                             if( res.fail == "NOT_INITALISED" ) selectPage("CREATE_PASSPHRASE");
                             else if ( res.fail == "NOT_LOADED" ) selectPage("GET_PASSPHRASE");
                         } else {
                             // Create new key using passphrase
                             (async () => {
                                //await openpgp.initWorker({ path: '../js/openpgp.worker.js' }); // set the relative web worker path

                                const { privateKeyArmored, publicKeyArmored, revocationCertificate } = await openpgp.generateKey({
                                    userIds: [{ name: MY_CONTEXT.keySetting_nameOnKey, email: MY_CONTEXT.keySetting_myIdentitifer }], // you can pass multiple user IDs
                                    curve: 'brainpoolP512r1',                                   // ECC curve name
                                    passphrase: res.passphrase           // protects the private key
                                });

                                // console.log(privateKeyArmored);     // '-----BEGIN PGP PRIVATE KEY BLOCK ... '
                                // console.log(publicKeyArmored);      // '-----BEGIN PGP PUBLIC KEY BLOCK ... '
                                // console.log(revocationCertificate); // '-----BEGIN PGP PUBLIC KEY BLOCK ... '

                                //document.getElementById("form-new-key-passphrase").value = "";
                                //document.getElementById("form-new-key").style.display="none";

                                let newKey = {
                                    uuid:generateUUID(),
                                    name:"Newly Generated Key",
                                    owner:"ME", // PHONE CODE
                                    pub: publicKeyArmored,
                                    priv: privateKeyArmored,
                                    created: `${new Date()}`,
                                    saved:`${new Date()}`
                                }

                                console.log(newKey);

                                let newKeyRequest = { action:"SAVE_NEW_KEY", newKey:newKey }
                                chrome.runtime.sendMessage( newKeyRequest, function(res) {

                                    MY_CONTEXT.defaultKey = newKey.uuid;
                                    saveMyContext();

                                    selectPage("KEY_MANAGEMENT");
                                });

                            })();
                         }
                     });

                }
             },
             {
                 id:"action-import-key",
                 func: ()=>{
                     popupSetText(`
                             <div class='segment popup-title'>Import Key</div>

                             <div class='segment'>NOT YET IMPLEMENTED</div>

                             <textarea id='keychain-import' class='keychain'></textarea>

                             <div class='segment' style='display:none;' id="import-error">Error parsing key import</div>

                             <div class='segment'>
                                <a id='popup-close' class='action'>Close</a>
                                <a id='keychain-action-import' class='action'>Import Key or Keychain</a>
                            </div>
                         `);

                     document.getElementById("popup-close").addEventListener("click",()=>{ popupDisplay(false); });
                     document.getElementById("keychain-action-import").addEventListener("click", ()=>{
                         document.getElementById("import-error").style.display = "none";
                         let impor = document.getElementById("keychain-import").value;

                         if( impor.startsWith("-----BEGIN PGP PUBLIC KEY BLOCK-----")) {

                         } else if (impor.startsWith("-----BEGIN PGP PRIVATE KEY BLOCK-----")) {

                         } else if ( impor.startsWith("[") && impor.endsWith("]") ){
                             try {
                                 let keysToImport = JSON.parse(impor);
                             } catch (e) {
                                 document.getElementById("import-error").style.display = "block";
                             }
                         } else {
                             document.getElementById("import-error").style.display = "block";
                         }
                     });
                     popupDisplay(true);
                }
             },
             {
                 id:"action-export-key",
                 func: ()=>{
                     popupSetText(`
                             <div class='segment popup-title'>Export Keychain</div>

                             <textarea id='keychain-export' class='keychain'></textarea>

                             <div class='segment'>
                                <a id='popup-close' class='action'>Close</a>
                                <a id='keychain-copy' class='action'>Copy to Clipboard</a>
                             </div>
                         `);

                     keychainLoadFull((keys)=>{
                         document.getElementById("keychain-export").innerHTML = JSON.stringify(keys,4);
                         document.getElementById("keychain-copy").addEventListener("click", ()=>{ copyToClipboard(JSON.stringify(keys)); });
                     });

                     document.getElementById("popup-close").addEventListener("click",()=>{ popupDisplay(false); });
                     popupDisplay(true);
                }
             },

         ]
     }

}


function selectPage( name ){

    let page = PAGE_DATA[name];
    if(page){

        if( page.content ){
            document.getElementById("page").innerHTML = page.content;

            if( page.clickListeners ){
                page.clickListeners.forEach((lis, i) => {
                    document.getElementById(lis.id).addEventListener("click",lis.func);
                });

            }
        }

        if( page.postFunc ){
            page.postFunc();
        }

    }

}




function init(){

    let pageActions = document.querySelectorAll(".action-page");
    pageActions.forEach((a, i) => {
        a.addEventListener("click",()=>{
            selectPage(a.getAttribute("page-name"));
        });
    });


    loadMyContext(()=>{
        console.log("Initial Context Loaded");
        console.log(MY_CONTEXT);
    });


}


// ==== CONTEXT LOADING AND SAVING ====
function loadMyContext( callback ){
    chrome.storage.sync.get(['myContext'], function(result) {
        if( result.myContext) {
            MY_CONTEXT = result.myContext;
        } else {
            MY_CONTEXT == null;
        }

        if( callback ) callback();
    });
}

function saveMyContext( callback = null){
    chrome.storage.sync.set({myContext: MY_CONTEXT}, function() {
        if( callback ) callback();
    });
}


// ==== KEYCHAIN FUNCTIONS ====
function keychainSave( key , callback = null){
    let k = `keychain-${key.owner}-${key.uuid}`;
    chrome.storage.sync.set({[k]: key}, function() {
        if( callback ) callback();
    });
}

function keychainLoad( ownerId ){

}

function keychainLoadFull( callback ){
    chrome.storage.sync.get(null, function(items) {
        let keys = [];

        let allKeys = Object.keys(items);
        allKeys.forEach((k, i) => {
            if( k.startsWith("keychain-")){
                keys.push(items[k]);
            }
        });

        callback(keys);
    });
}

// ==== Popup Functions ====
function popupDisplay( status ){
    if( status ){
        document.getElementById("popup-container").style.display = "flex";
    } else {
        document.getElementById("popup-container").style.display = "none";
    }
}

function popupSetText( text ){
    document.getElementById("popup").innerHTML = text;
}

// ==== Initalisation ====
init();
if( window.location.hash ){
    selectPage(window.location.hash.replace("#",""));
} else {
    selectPage("KEY_MANAGEMENT");
}

// Key Structure
/*
    {
        uuid:"",
        name:"",
        owner:"", // PHONE CODE
        pub:    ,
        priv:   ,
        created:,
        saved:,
    }
*/


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

function getHash(str){
    const myBitArray = sjcl.hash.sha256.hash(str)
    const myHash = sjcl.codec.hex.fromBits(myBitArray)
    return myHash;
}




function copyToClipboard( str ) {
    const el = document.createElement('textarea');
    el.value = str;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
}
