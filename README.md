# Config GUI Web

Use this application to open a GUI to enable you to configure an OSM with various settings.

This project uses osm\_firmware as a submodule, so you may need to enter the following:

    git submodule update --init --recursive

There may be packages to install for that repository, check the docs in there for getting started with OSM firmware.

## Run Application


At the top level directory of the application, enter the following:

    make webhost

This will bundle the files required by the application into 'build' and start a web server on localhost:8000

Go to this url in your browser to start using the GUI.

## File Structure

The binding between the OSM and the user is found in app/modules/backend/binding.js.

The code for the front end of the application is found in app/modules/gui.

The HTML that these scripts use is found in app/modules/gui/html.

The CSS is found in app/modules/styles.
