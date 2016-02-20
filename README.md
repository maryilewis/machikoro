# machikoro
Online version of the board game. First attempt at node.js and socket.io. First program primarily in Javascript. Not quite finished and needs polishing.

## Instructions to install on Windows:
1.	Install Node.js. Available here: https://nodejs.org/en/download/
2.	Download this project to your computer
3.	Navigate to the machikoro folder you just downloaded via the command line, and enter "npm install"

## Instructions to run:
1.	On the command line in the machikoro folder enter "node index.js". It should say "listening on *:3000"
2.	Visit http://127.0.0.1:3000/ and it should be running!
3.	If you add multiple people before hitting "start game" they'll be put in the same game room.

## To Do

The back end is only missing a couple of things for it to be functional: Business Center and TV station handling, namely.
The front end is a right mess, HTML-wise, but it's nearly functional as well.
I need to update the packages file with the actual requirements.
I never got it to serve multiple files, so the JS and CSS are right there in the HTML.  Not ideal.

My goal was to have the sever handling multiple games at once, and I think it just about does that although I'd be unsurprised at a bit of noise creeping across.  It's hard to test because I can't for the life of me access the game outside my home computer who acts as server, as much as I've messed with the IP and the ports and the router and the firewall.

So my original goal (play Machi Koro with my boyfriend when we're apart) is possibly impossible, causing my momentum to flag quite a bit.
