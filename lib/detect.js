var spawn = require( 'child_process' ).spawn,
	winDetect = require( 'win-detect-browsers' ),
	darwin = require( './darwin' ),
	extend = require( 'lodash' ).extend,
	browsers = { // List of commands and version regex for Linux and Mac
		chrome: {
			re: /Google Chrome (\S+)/,
			profile: true,
			variants: {
				chrome: [ 'google-chrome', 'google-chrome-stable' ],
				beta: 'google-chrome-beta',
				canary: 'google-chrome-canary'
			}
		},
		chromium: {
			re: /Chromium (\S+)/,
			profile: true,
			variants: {
				chromium: [ 'chromium', 'chromium-browser' ]
			}
		},
		firefox: {
			re: /Mozilla Firefox (\S+)/,
			profile: true,
			variants: {
				firefox: 'firefox',
				developer: 'firefox-developer'
			}
		},
		phantomjs: {
			re: /(\S+)/,
			profile: false,
			headless: true,
			variants: 'phantomjs'
		},
		safari: {
			profile: false,
			variants: 'safari'
		},
		ie: {
			profile: false,
			variants: 'ie'
		},
		opera: {
			re: /Opera (\S+)/,
			profile: true,
			variants: 'opera'
		}
	};

/**
 * Detect all available browsers on Windows systems.
 * Pass an array of detected browsers to the callback function when done.
 * @param {Function} callback Callback function
 */
function detectWindows( callback ) {
	winDetect( function( found ) {
		var available = found.map( function( browser ) {
			return {
				name: browser.name,
				type: browser.name,
				command: browser.path,
				version: browser.version
			};
		} );

		callback( available );
	} );
}

/**
 * Check if the given browser is available (on OSX systems).
 * Pass its version and path to the callback function if found.
 * @param {String}   name     Name of a browser
 * @param {Function} callback Callback function
 */
function checkDarwin( name, callback ) {
	if ( darwin[ name ] ) {
		if ( darwin[ name ].all ) {
			darwin[ name ].all( function( err, available ) {
				if ( err ) {
					callback( 'failed to get version for ' + name );
				} else {
					callback( err, available );
				}
			} );
		} else {
			darwin[ name ].version( function( err, version ) {
				if ( version ) {
					darwin[ name ].path( function( err, p ) {
						if ( err ) {
							return callback( 'failed to get path for ' + name );
						}

						callback( null, version, p );
					} );
				} else {
					callback( 'failed to get version for ' + name );
				}
			} );
		}
	} else {
		checkOthers( name, callback );
	}
}

/**
 * Check if the given browser is available (on Unix systems).
 * Pass its version to the callback function if found.
 * @param {String}   name     Name of a browser
 * @param {Function} callback Callback function
 */
function checkOthers( name, callback ) {
	var process = spawn( name, [ '--version' ] ),
		re = browsers[ name ].re,
		data = '';

	process.stdout.on( 'data', function( buf ) {
		data += buf;
	} );

	process.on( 'error', function() {
		callback( 'not installed' );
		callback = null;
	} );

	process.on( 'close', function( code ) {
		if ( !callback ) {
			return;
		}

		if ( code !== 0 ) {
			return callback( 'not installed' );
		}

		var m = re.exec( data );

		if ( m ) {
			callback( null, m[ 1 ] );
		} else {
			callback( null, data.trim() );
		}
	} );
}

/**
 * Detect all available web browsers.
 * Pass an array of available browsers to the callback function when done.
 * @param {Function} callback Callback function
 */
module.exports = function detect( callback ) {
	var available = [],
		names,
		check;

	if ( process.platform === 'win32' ) {
		return detectWindows( callback );
	} else if ( process.platform === 'darwin' ) {
		check = checkDarwin;
	} else {
		check = checkOthers;
	}

	names = Object.keys( browsers );

	function next() {
		var name = names.shift();

		if ( !name ) {
			return callback( available );
		}

		var br = browsers[ name ];

		check( name, function( err, v, p ) {
			if ( err === null ) {
				if ( Array.isArray( v ) ) {
					v.forEach( function( item ) {
						available.push( extend( {}, br, {
							command: item.path,
							version: item.version
						} ) );
					} );
				} else {
					available.push( extend( {}, br, {
						command: p || name,
						version: v
					} ) );
				}
			}

			next();
		} );
	}

	next();
};
