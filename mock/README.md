# Mock Tessel

This directory contains a Node application that uses the Organiq SDK for Tessel,
even though it is intended to be run from a normal Node environment. It's here
just to provide a skeleton for easy testing of application/device interaction
that doesn't require having a live Tessel.

The /tessel directory is the fake (mock) Tessel device. The /app directory is
an app that connects and interacts with the fake device.

    $ npm install -g organiq    # once, if not already done
    $ organiq server start

    $ cd tessel
    $ npm install
    $ organiq init --local-dev
    $ node mock.js

    $ cd ../app
    $ npm install
    $ organiq init --local-dev
    $ node app.js
    
