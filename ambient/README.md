# Tessel Ambient Module via Organiq

This example shows how you can expose functionality from a [Tessel Ambient
module](https://tessel.io/docs/ambient) attached to your Tessel to client
applications connected via the Organiq SDK.

There are two applications in this folder: one (in the /tessel directory) that
is to be deployed and run on your Tessel, and one (in the /app directory) that
is a standalone node application that will communicate with the Tessel over
the web.

The example is coded to expect an ambient-attx4  module connected to port 'B'
of your Tessel.
 
## Running the example

If you haven't already done so, install the Organiq SDK on your development
machine and start up a local Organiq development server to test with:

    $ npm install -g organiq   # install organiq globally
    $ organiq server start      # start dev server on port 1340

To configure and deploy the Tessel application on your device, first make sure
that the Ambient module is attached to port 'B', and that the Tessel is
connected to your machine. Then:

    $ cd tessel
    $ npm install --production  # install minimal libraries
    $ organiq init --local-dev  # create organiq.json in cur dir
    $ tessel run ambient.js     # deploy and run

You can then start up the node application:

    $ cd app
    $ npm install
    $ organiq init --local-dev
    $ node ambient-app.js

Note that you only need to do the `organiq init --local-dev` step once. It
sets up a `organiq.json` [configuration file](http://organiq-tessel.readthedocs.org/en/latest/configuration/)
that tells the Organiq runtime where to find the server.

That being done, you ought to see the current light and sound readings as
reported by the Tessel being output by the node app every few seconds.

