/* Copyright (c) 2010 - 2017, Nordic Semiconductor ASA
 *
 * All rights reserved.
 *
 * Use in source and binary forms, redistribution in binary form only, with
 * or without modification, are permitted provided that the following conditions
 * are met:
 *
 * 1. Redistributions in binary form, except as embedded into a Nordic
 *    Semiconductor ASA integrated circuit in a product or a software update for
 *    such product, must reproduce the above copyright notice, this list of
 *    conditions and the following disclaimer in the documentation and/or other
 *    materials provided with the distribution.
 *
 * 2. Neither the name of Nordic Semiconductor ASA nor the names of its
 *    contributors may be used to endorse or promote products derived from this
 *    software without specific prior written permission.
 *
 * 3. This software, with or without modification, must only be used with a Nordic
 *    Semiconductor ASA integrated circuit.
 *
 * 4. Any software provided in binary form under this license must not be reverse
 *    engineered, decompiled, modified and/or disassembled.
 *
 * THIS SOFTWARE IS PROVIDED BY NORDIC SEMICONDUCTOR ASA "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY, NONINFRINGEMENT, AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL NORDIC SEMICONDUCTOR ASA OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
 * TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/*
 * nRF5x Command Line Tools (nrfjprog) is required for pc-nrfjprog-js to function.
 * This script checks if nrfjprog libraries are found, and installs them if required.
 *
 * On Linux/macOS, the nrfjprog artifact (tar) is extracted into nrfjprog/lib. This
 * directory will then contain both headers (required when building) and libraries
 * (required at runtime).
 *
 * On Windows, the nrfjprog installer (exe) is run, which installs the libraries and
 * headers in Program Files. The pc-nrfjprog-js library will then find the nrfjprog
 * libraries by doing a registry lookup.
 */

'use strict';

const https = require('https');
const tar = require('tar');
const fs = require('fs');
const sander = require('sander');
const path = require('path');
const opn = require('opn');
const semver = require('semver');

const DOWNLOAD_DIR = path.join(__dirname, '..', 'nrfjprog');
const LIB_DIR = path.join(DOWNLOAD_DIR, 'lib');
const PLATFORM_CONFIG = {
    win32_ia32: {
        // See https://www.nordicsemi.com/eng/nordic/Products/nRF52840/nRF5x-Command-Line-Tools-Win32/58850
        url: 'https://www.nordicsemi.com/eng/nordic/download_resource/58850/51/33271593/53210',
        destinationFile: path.join(DOWNLOAD_DIR, 'nrfjprog-win32-ia32.exe'),
    },
    win32_x64: {
        // See
        url: 'https://www.nordicsemi.com/eng/nordic/download_resource/70507/2/82059498/150713',
        destinationFile: path.join(DOWNLOAD_DIR, 'nrfjprog-win32-x64.exe'),
    },
    linux_x64: {
        // See https://www.nordicsemi.com/eng/nordic/Products/nRF52840/nRF5x-Command-Line-Tools-Linux64/58852
        url: 'https://www.nordicsemi.com/eng/nordic/download_resource/58852/30/91363763/94917',
        destinationFile: path.join(DOWNLOAD_DIR, 'nrfjprog-linux64.tar'),
    },
    darwin: {
        // See https://www.nordicsemi.com/eng/nordic/Products/nRF52840/nRF5x-Command-Line-Tools-OSX/58855
        url: 'https://www.nordicsemi.com/eng/nordic/download_resource/58855/22/48944001/99977',
        destinationFile: path.join(DOWNLOAD_DIR, 'nrfjprog-darwin.tar'),
    },
};
const REQUIRED_VERSION = {
    major: 9,
    minor: 8,
    revision: 0,
};

function downloadFile(url, destinationFile) {
    console.log(`Downloading nrfjprog from ${url} to ${destinationFile}...`);

    const destinationDir = path.dirname(destinationFile);
    return sander.mkdir(destinationDir)
        .then(() => new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destinationFile);
            https.get(url, response => {
                const statusCode = response.statusCode;
                if (statusCode !== 200) {
                    reject(new Error(`Unable to download ${url}. Got status code ${statusCode}`));
                } else {
                    response.pipe(file);
                    response.on('error', reject);
                    response.on('end', () => {
                        file.end();
                        resolve();
                    });
                }
            });
        }));
}

function extractTarFile(filePath, outputDir) {
    return sander.mkdir(outputDir)
        .then(() => tar.extract({
            file: filePath,
            filter: f => f.match(/\.so|\.dylib$|\.h$/),
            strip: 2,
            keep: true,
            cwd: outputDir,
        }));
}

function getLibraryVersion() {
    return new Promise((resolve, reject) => {
        try {
            // eslint-disable-next-line global-require
            const nrfjprog = require('..');
            nrfjprog.getLibraryVersion((err, version) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(version);
                }
            });
        } catch (ex) {
            reject(ex);
        }
    });
}

function isHeaderFileInstalledWin32() {
    let programFilesDir
    if (process.arch === 'ia32') {
        programFilesDir = process.env['ProgramFiles(x86)'] || process.env.ProgramFiles;
    } else if (process.arch === 'x64') {
        programFilesDir = process.env['ProgramW6432'] || process.env.ProgramFiles;
    } else {
        throw Error(`Arch ${process.arch} is not supported.`);
    }
    const headerFile = path.join(programFilesDir, 'Nordic Semiconductor', 'nrf5x', 'bin', 'headers', 'nrfjprog.h');
    try {
        fs.accessSync(headerFile);
        return true;
    } catch (ex) {
        return false;
    }
}

function removeFileIfExists(filePath) {
    if (sander.existsSync(filePath)) {
        return sander.unlink(filePath);
    }
    return Promise.resolve();
}

function removeDirIfExists(dirPath) {
    if (sander.existsSync(dirPath)) {
        return sander.rimraf(dirPath);
    }
    return Promise.resolve();
}

function installNrfjprog(pathToArtifact) {
    if (pathToArtifact.endsWith('.tar')) {
        console.log(`Extracting ${pathToArtifact} to ${LIB_DIR}...`);
        return removeDirIfExists(LIB_DIR)
            .then(() => extractTarFile(pathToArtifact, LIB_DIR));
    } else if (pathToArtifact.endsWith('.exe')) {
        console.log(`Running nrfjprog installer at ${pathToArtifact}...`);
        return opn(pathToArtifact);
    }
    return Promise.reject(new Error(`Unsupported nrfjprog artifact: ${pathToArtifact}`));
}

const platform = process.platform;
const arch = process.arch;
let platformConfigStr;
if (platform === 'win32' || platform === 'linux') {
    platformConfigStr = `${platform}_${arch}`
} else if (platform === 'darwin') {
    platformConfigStr = platform
}
const platformConfig = PLATFORM_CONFIG[platformConfigStr];

if (!platformConfig) {
    console.error(`Unsupported platform: '${platform}'. Cannot install nrfjprog libraries.`);
    process.exit(1);
}

let isInstallationRequired = false;
getLibraryVersion()
    .then(version => {
        const currentVersion = `${version.major}.${version.minor}.${version.revision}`;
        const requiredVersion = `${REQUIRED_VERSION.major}.${REQUIRED_VERSION.minor}` +
            `.${REQUIRED_VERSION.revision}`;
        if (semver.lt(currentVersion, requiredVersion)) {
            console.log(`Found nrfjprog version ${currentVersion}, but ` +
                `${requiredVersion} is required`);
            isInstallationRequired = true;
        } else {
            console.log('Found nrfjprog libraries at required version', version);
        }
    })
    .catch(error => {
        // If we have nrfjprog header files on win32, then assume nrfjprog is installed
        if (platform === 'win32' && isHeaderFileInstalledWin32()) {
            isInstallationRequired = false;
        } else {
            console.log(`Validation of nrfjprog libraries failed: ${error.message}`);
            isInstallationRequired = true;
        }
    })
    .then(() => {
        if (isInstallationRequired) {
            console.log('Trying to install nrfjprog');

            let exitCode = 0;
            return downloadFile(platformConfig.url, platformConfig.destinationFile)
                .then(() => installNrfjprog(platformConfig.destinationFile))
                .catch(error => {
                    exitCode = 1;
                    console.error(`Error when installing nrfjprog libraries: ${error.message}`);
                })
                .then(() => removeFileIfExists(platformConfig.destinationFile))
                .catch(error => {
                    exitCode = 1;
                    console.error(`Unable to remove downloaded nrfjprog artifact: ${error.message}`);
                })
                .then(() => process.exit(exitCode));
        }
        return Promise.resolve();
    });
