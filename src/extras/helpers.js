//Requires
const fs = require('fs');
const path = require('path');


//================================================================
/**
 * txAdmin in ASCII
 */
function txAdminASCII() {
    //NOTE: precalculating the ascii art for efficiency
    // const figlet = require('figlet');
    // let ascii = figlet.textSync('txAdmin');
    // let b64 = Buffer.from(ascii).toString('base64');
    // console.log(b64);
    const preCalculated = `ICBfICAgICAgICAgICAgXyAgICAgICBfICAgICAgICAgICBfICAgICAgIAogfCB8X19fICBfX
    yAgIC8gXCAgIF9ffCB8XyBfXyBfX18gKF8pXyBfXyAgCiB8IF9fXCBcLyAvICAvIF8gXCAvIF9gIHwgJ18gYCBfIFx8IHwg
    J18gXCAKIHwgfF8gPiAgPCAgLyBfX18gXCAoX3wgfCB8IHwgfCB8IHwgfCB8IHwgfAogIFxfXy9fL1xfXC9fLyAgIFxfXF9
    fLF98X3wgfF98IHxffF98X3wgfF98CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA=`;
    return Buffer.from(preCalculated, 'base64').toString('ascii');
}


//================================================================
/**
 * Check if the packages in package.json were installed
 */
function dependencyChecker() {
    if (process.env.APP_ENV === 'webpack') {
        return;
    }

    try {
        let rawFile = fs.readFileSync(GetResourcePath(GetCurrentResourceName()) + '/package.json');
        let parsedFile = JSON.parse(rawFile);
        let packages = Object.keys(parsedFile.dependencies)
        let missing = [];
        packages.forEach(package => {
            try {
                require.resolve(package);
            } catch (error) {
                missing.push(package);
            }
        });
        if(missing.length){
            console.log(`[txAdmin:PreCheck] Cannot start txAdmin due to missing dependencies.`);
            console.log(`[txAdmin:PreCheck] Make sure you executed 'npm i'.`);
            console.log(`[txAdmin:PreCheck] The following packages are missing: ` + missing.join(', '));
            console.log();
            console.log(`[txAdmin:PreCheck] GO THE THE GITHUB RELEASES PAGE AND DOWNLOAD THE COMPILED ZIP FILE INSTEAD OF THE SOURCE`);
            process.exit();
        }
    } catch (error) {
        console.log(`[txAdmin:PreCheck] Error reading or parsing package.json: ${error.message}`);
        process.exit();
    }
}


//================================================================
/**
 * Extracts hours and minutes from an string containing times
 * @param {string} schedule 
 * @param {boolean} filter default true
 */
function parseSchedule(schedule, filter = true) {
    times = (typeof schedule === 'string')? schedule.split(',') : schedule;
    let out = []
    times.forEach((time) => {
        if(!time.length) return;
        const regex = /^$|^([01]?[0-9]|2[0-3]):([0-5][0-9])$/gm;
        let m = regex.exec(time.trim())
        if(m === null){
            if(!filter) out.push(time);
        }else{
            out.push({
                string: m[0],
                hour: parseInt(m[1]),
                minute: parseInt(m[2]),
            });
        }
    });

    return out;
}


//================================================================
/**
 * Reads CFG Path and return the file contents, or throw error if:
 *  - the path is not valid (must be absolute)
 *  - cannot read the file data
 * @param {string} cfgFullPath
 */
function getCFGFileData(cfgPath) {
    //Validating if the path is absolute
    if(!path.isAbsolute(cfgPath)){
        throw new Error("File path must be absolute.");
    }

    //Validating file existence
    if(!fs.existsSync(cfgPath)){
        throw new Error("File doesn't exist or its unreadable.");
    }

    //Validating if its actually a file
    if(!fs.lstatSync(cfgPath).isFile()){
        throw new Error("File doesn't exist or its unreadable. Make sure to include the CFG file in the path, and not just the directory that contains it.");
    }

    //Reading file
    try {
        return fs.readFileSync(cfgPath).toString();
    } catch (error) {
        throw new Error("Cannot read CFG file.");
    }
}


//================================================================
/**
 * Returns the absolute path of the given CFG Path
 * @param {string} cfgPath
 * @param {string} serverDataPath
 */
function resolveCFGFilePath(cfgPath, serverDataPath) {
    return (path.isAbsolute(cfgPath))? cfgPath : path.resolve(serverDataPath, cfgPath);
}


//================================================================
/**
 * Processes cfgPath and returns the fxserver port or throw errors if:
 *  - Regex Match Error
 *  - no endpoints found
 *  - endpoints that are not 0.0.0.0:xxx
 *  - port mismatch
 *  - "stop monitor"
 *  - if endpoint on 40120~40130
 *  - zap-hosting iface and port enforcement
 * @param {string} rawCfgFile
 */
function getFXServerPort(rawCfgFile) {
    if(rawCfgFile.includes('stop monitor')) throw new Error(`Remove "stop monitor" from your config`);

    const maxClientsRegex = /^\s*sv_maxclients\s+(\d+).*$/gim;
    const endpointsRegex = /^\s*endpoint_add_(\w+)\s+["']?([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\:([0-9]{1,5})["']?.*$/gim;
    // const endpointsRegex = /endpoint_add_(\w+)\s+["']?([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\:([0-9]{1,5})["']?.*/gi;
    let endpoints = [];
    let maxClients = [];
    try {
        let match;
        while (match = endpointsRegex.exec(rawCfgFile)) {
            endpoints.push({
                line: match[0].trim(),
                type: match[1].toLowerCase(),
                iface: match[2],
                port: parseInt(match[3]),
            });
        }
        while (match = maxClientsRegex.exec(rawCfgFile)) {
            maxClients.push(parseInt(match[1]));
        }
    } catch (error) {
        throw new Error("Regex Match Error");
    }
    
    //Checking for the maxClients 
    if(GlobalData.deployerDefaults && GlobalData.deployerDefaults.maxClients){
        if(!maxClients.length){
            throw new Error(`Zap-Hosting: please add 'sv_maxclients ${GlobalData.deployerDefaults.maxClients}' to your server.cfg.`);
        }
        if(maxClients.some(mc => mc > GlobalData.deployerDefaults.maxClients)){
            throw new Error(`Zap-Hosting: your 'sv_maxclients' MUST be less or equal than ${GlobalData.deployerDefaults.maxClients}.`);
        }
    }


    //Checking if endpoints present at all
    const oneTCPEndpoint = endpoints.find((m) => (m.type === 'tcp'));
    if(!oneTCPEndpoint) throw new Error("You MUST have at least one <code>endpoint_add_tcp</code> in your config");
    const oneUDPEndpoint = endpoints.find((m) => (m.type === 'udp'));
    if(!oneUDPEndpoint) throw new Error("You MUST have at least one <code>endpoint_add_udp</code> in your config");

    //FIXME: Think of something to make this work:
    const firstPort = endpoints[0].port;
    endpoints.forEach((m) => {
        if(m.port !== firstPort) throw new Error("All <code>endpoint_add_*</code> MUST have the same port");
    });

    if(firstPort >= 40120 && firstPort <= 40130){
        throw new Error(`The port ${port} is dedicated for txAdmin and can not be used for FXServer, please edit your <code>endpoint_add_*</code>`);
    }

    //IF Zap-hosting interface bind enforcement
    if(GlobalData.forceInterface){
        const stdMessage = [
            `Remove all lines containing <code>endpoint_add</code> and add the lines below to the top of your file.`,
            `<code>endpoint_add_tcp "127.0.0.1:${GlobalData.forceFXServerPort}"`,
            `endpoint_add_tcp "${GlobalData.forceInterface}:${GlobalData.forceFXServerPort}"`,
            `endpoint_add_udp "${GlobalData.forceInterface}:${GlobalData.forceFXServerPort}" </code>`,
        ].join('\n<br>');

        //Check if all ports are the ones being forced
        if(firstPort !== GlobalData.forceFXServerPort){
            throw new Error(`Zap-Hosting: invalid port found.<br>\n ${stdMessage}`);
        }

        //Check if all interfaces are the ones being forced
        const invalidInterface = endpoints.find((match) => {
            return (match.iface !== GlobalData.forceInterface && match.iface !== '127.0.0.1')
        });
        if(invalidInterface) throw new Error(`Zap-Hosting: invalid interface '${invalidInterface.iface}'.<br>\n${stdMessage}`);

        //Check if the server is listening on the loopback interface
        const listeningOnLoopback = endpoints.find((match) => {
            return (match.type === 'tcp' && match.iface === '127.0.0.1')
        });
        if(!listeningOnLoopback) throw new Error(`Zap-Hosting: missing interface '127.0.0.1'.\n${stdMessage}`);

    }else{
        const validTCPEndpoint = endpoints.find((match) => {
            return (match.type === 'tcp' && (match.iface === '0.0.0.0' || match.iface === '127.0.0.1'))
        })
        if(!validTCPEndpoint) throw new Error("You MUST have one <code>endpoint_add_tcp</code> with IP 0.0.0.0 in your config");
    }

    return firstPort;
}


//================================================================
/**
 * Returns the first likely server.cfg given a server data path, or false
 * @param {string} serverDataPath
 */
function findLikelyCFGPath(serverDataPath) {
    const attempts = [
        'server.cfg',
        'server.cfg.txt',
        'server.cfg.cfg',
        'server.txt',
        'server',
        '../server.cfg',
    ]

    for (let i = 0; i < attempts.length; i++) {
        const cfgPath = path.join(serverDataPath, attempts[i]);
        try {
            getCFGFileData(cfgPath);
            return cfgPath;
        } catch (error) {}
    }
    return false;
}



module.exports = {
    txAdminASCII,
    dependencyChecker,
    parseSchedule,
    getCFGFileData,
    resolveCFGFilePath,
    getFXServerPort,
    findLikelyCFGPath,
}
