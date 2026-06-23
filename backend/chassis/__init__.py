"""Chassis backend package.

Holds the domain logic for the Chassis app, split into focused modules:
  text   - competition framing and title casing
  store  - all CRUD, JSON persistence, and in-memory demo boards
  seed   - demo board seed content
  search - standard-library fuzzy search
  pdf    - engineering notebook PDF export

The Flask app in app.py wires these together and exposes them over HTTP. None
of these modules import Flask, so they stay testable on their own.
"""
