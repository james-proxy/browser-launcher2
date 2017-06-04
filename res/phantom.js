/* global phantom */
var webpage = require( 'webpage' ),
	system = require( 'system' ),
	currentUrl = system.args[ 2 ],
	page;

function renderPage( url ) {
	page = webpage.create();
	page.windowName = 'my-window';
	page.settings.webSecurityEnabled = false;

	// handle redirects
	page.onNavigationRequested = function( url, type, willNavigate, main ) {
		if ( main && url != currentUrl ) {
			currentUrl = url;
			page.close();
			renderPage( url );
		}
	};

	// handle logs
	page.onConsoleMessage = function( msg ) {
		console.log( 'console: ' + msg );
	};
	
	page.onResourceError = function(resourceError) {
		console.log( resourceError.url + ': ' + resourceError.errorString );
	};

	page.onError = function( msg, trace ) {
		console.log( 'error:', msg );
		trace.forEach( function( item ) {
			console.log( '  ', item.file, ':', item.line );
		} );
	};

	page.open( url, function( status ) {
		console.log( 'status:', status );
		if ( status !== 'success' ) {
			phantom.exit( 1 );
		}
	} );
}

renderPage( currentUrl );
