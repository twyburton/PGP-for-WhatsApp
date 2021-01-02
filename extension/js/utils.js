

function getPubFingerprint( pub, callback = null ){
    openpgp.key.readArmored(pub).then((openkey)=>{
        openkey = openkey.keys[0];

        // FINGERPRINT
        let fp = "";
        openkey.primaryKey.fingerprint.forEach((n, i) => {
            let num = n.toString(16)
            fp += ( num.length == 1 ? "0":"") + num;
            if( i%2 == 1 ) fp += " ";
        });

        if( callback ) callback( fp.toUpperCase() );
    }).catch((err)=>{
        console.log(err);
    });

}


function getPubId( pub, callback = null ){

    (async () => {
        let openkey = await openpgp.key.readArmored(pub);
        openkey = openkey.keys[0];

        // ID
        let keyid = "";
        idbytes = openkey.primaryKey.keyid.bytes;
        for( let u = 0 ; u < idbytes.length; u++ ){
            let num = idbytes.charCodeAt(u).toString(16);
            keyid += ( num.length == 1 ? "0":"") + num;
        }

        if( callback ) callback( keyid.toUpperCase() );

    })();
}

function getKeyId( keyid ){
    // ID
    let str = "";
    idbytes = keyid.bytes;
    for( let u = 0 ; u < idbytes.length; u++ ){
        let num = idbytes.charCodeAt(u).toString(16);
        str += ( num.length == 1 ? "0":"") + num;
    }

    return str.toUpperCase();
}

function keychainLoadKeyById( keyIdTarget ){

    let keyIdPromise = new Promise( (resolve,reject) =>{

        chrome.storage.sync.get(null, function(items) {

            let allKeys = Object.keys(items);
            // Filter out items which are not keys
            allKeys = allKeys.filter((i)=>{
                return i.startsWith("keychain-");
            })
            let keysToCheck = allKeys.length;
            // Go through each key and look for match
            allKeys.forEach((k, i) => {
                getPubId(items[k].pub,(keyid)=>{

                    keysToCheck--;
                    if( keyid == keyIdTarget) resolve( items[k].owner );

                    // All keys checked and no match found
                    if( keysToCheck == 0 ){
                        reject("Key not found");
                    }
                });
            });


        });
    });

    return keyIdPromise;
}


function convertDate(str){
    let a = str;
    let year = a.getFullYear();
    let month = a.getMonth()+1;
    let date = (a.getDate() < 10 ? '0' + a.getDate() : a.getDate());
    let time = year + '-' + month + '-' + date ;
    return time;
}

function convertDatetime(str){
    let a = str;
    let months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let year = a.getFullYear();
    let month = months[a.getMonth()];
    let date = (a.getDate() < 10 ? '0' + a.getDate() : a.getDate());
    let hour = (a.getHours() < 10 ? '0' + a.getHours() : a.getHours());
    let min = (a.getMinutes() < 10 ? '0' + a.getMinutes() : a.getMinutes());
    let sec = (a.getSeconds() < 10 ? '0' + a.getSeconds() : a.getSeconds());
    let time = hour + ':' + min + ':' + sec + ' ' + date + '/' + month + '/' + year ;
    return time;
}
