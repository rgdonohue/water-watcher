// Mock Leaflet for testing
const mockDivIcon = jest.fn().mockImplementation((options) => ({
  options: {
    ...options,
    html: options.html || ''
  }
}));

const leaflet = {
  Icon: {
    Default: {
      prototype: {
        _getIconUrl: jest.fn(),
      },
      mergeOptions: jest.fn(),
    },
  },
  divIcon: mockDivIcon,
  latLng: (lat, lng) => ({ lat, lng }),
  latLngBounds: () => ({
    extend: jest.fn(),
    getNorthEast: () => ({ lat: 40.5, lng: -106.0 }),
    getSouthWest: () => ({ lat: 35.0, lng: -114.0 })
  })
};

module.exports = leaflet;
