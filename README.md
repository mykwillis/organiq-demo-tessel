# Demos using Organiq on Tessel

This project contains several demonstrations of using the [Organiq SDK]
(https://github.com/organiq/organiq-sdk-js) to write applications that interact
with Tessel microcontrollers over the web.

Examples typically have the following directory structure:

*   / - project root, contains README.MD, etc.
*   /tessel - device-specific code that is to be deployed and run on the Tessel
*   /app - standalone Node console app that interacts with Tessel code
*   /web - browser-based app

## Running the examples

If you haven't already done so, install the Organiq SDK on your development
machine and start up a local Organiq development server to test with:

    $ npm install -g organiq   # install organiq globally
    $ organiq server start      # start dev server on port 1340

To configure and deploy the Tessel application on your device, first make sure
that the Tessel is connected to your development machine. Then:

    $ cd tessel
    $ npm install --production  # install minimal libraries
    $ organiq init --local-dev  # create organiq.json in cur dir
    $ tessel run {project}.js     # deploy and run

You can then start up the node application:

    $ cd app
    $ npm install
    $ organiq init --local-dev
    $ node {project}-app.js

(Note that you only need to do the `organiq init --local-dev` step once in each
directory. It sets up a `organiq.json` [configuration file](http://organiq-tessel.readthedocs.org/en/latest/configuration/)
that tells the Organiq runtime where to find the server.)


