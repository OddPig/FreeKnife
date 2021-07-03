# FreeKnife
This program is an unoffical open-source controller for Cricut brand cutting machines.

FreeKnife is not associated with Cricut, Inc. “Cricut” and all related elements are copyrights of Cricut, Inc.

Do you work for Cricut? If so, please check out the open letter [here](https://github.com/OddPig/FreeKnife/blob/main/OPENLETTER.md).</a>

## Current State

This extremely early version of this program has bugs, and may damage your machine. This version is designed for people who will test this software and report bugs.

Major limitations include, but are not limited to:
* Wonky SVG pathing
* Wonky SVG parsing, such as no parsing for clippaths or text. Outline everything first if you want it to work.
* Only support for the "B" toolhead
* Poor error handling

**I have not tested this with anything other than an Explore Air 2.** But if you have a different device, I'm interested in hearing from you! Log a bug with what did or did not work for you.

If you want to use this software, you probably should not install further firmware updates from Cricut (unless they commit to not intentionally breaking this). It would be very simple for them to undo all the work here via a firmware update/

**Please don't hesitate to contribute if you feel at all inclined. I'm a bit burnt out on this one, so your contributions are valued.**

## Install

TODO add releases.

## Building from source

The use of the [yarn](https://yarnpkg.com/) package manager is **strongly** recommended, as opposed to using `npm`.

```bash
# install dependencies
yarn install
yarn run rebuild

# run application in development mode
yarn run dev

# compile source code and create webpack output
yarn run compile

# `yarn compile` & create build with electron-builder
yarn run dist

# `yarn compile` & create unpacked build with electron-builder
yarn run dist:dir
```

## Common Issues

If you get permissions errors on Linux when connection to a device, add yourself to dialout.
```bash
sudo usermod -a -G dialout $USER
```

If your device stops wanting to handshake, powercycle it. Not sure why this is necessary, TODO investigate more.

## Contact

oddpig#5209 on Discord
oddpig@protonmail.com
