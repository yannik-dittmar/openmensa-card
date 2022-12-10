[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)

# openmensa-card
A little lovelace card that can display multiple canteens from openmensa.org 

## Installation
Add this repository to your custom HACS repositories.
`https://github.com/yannik-dittmar/openmensa-card`

```yaml
resources:
  - url: /local/community/openmensa-card/openmensa-card.js
    type: module
```

## Configuration
To add the card to your lovelace dashboard, first search for the manual card. Then enter the following:
```yaml
type: custom:openmensa-card
mensa-ids:
    - 1
    - 2
    ...
```