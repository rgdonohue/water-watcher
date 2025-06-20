#!/usr/bin/env python3
"""
Debug script for Colorado Plateau Water Analysis
Run this instead of the notebook for easier debugging with AI assistance
"""

import sys
import os

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_imports():
    """Test all required imports"""
    print("🔧 Testing imports...")
    
    try:
        import pandas as pd
        print(f"✅ pandas {pd.__version__}")
    except ImportError as e:
        print(f"❌ pandas: {e}")
        return False
        
    try:
        import requests
        print(f"✅ requests available")
    except ImportError as e:
        print(f"❌ requests: {e}")
        return False
        
    try:
        import folium
        print(f"✅ folium {folium.__version__}")
    except ImportError as e:
        print(f"❌ folium: {e}")
        return False
        
    return True

def create_sample_data():
    """Create sample USGS site data"""
    import pandas as pd
    
    sample_sites = [
        {'site_no': '09371010', 'station_nm': 'SAN JUAN RIVER AT FOUR CORNERS, CO', 
         'lat': 36.9989, 'lon': -109.0453, 'state': 'CO', 'county': '083', 'huc_cd': '14080201'},
        {'site_no': '09379500', 'station_nm': 'SAN JUAN RIVER NEAR BLUFF, UT', 
         'lat': 37.1906, 'lon': -109.5281, 'state': 'UT', 'county': '037', 'huc_cd': '14080204'},
        {'site_no': '09368000', 'station_nm': 'SAN JUAN RIVER AT SHIPROCK, NM', 
         'lat': 36.7856, 'lon': -108.7267, 'state': 'NM', 'county': '045', 'huc_cd': '14080105'},
        {'site_no': '09364500', 'station_nm': 'ANIMAS RIVER AT FARMINGTON, NM', 
         'lat': 36.7281, 'lon': -108.1842, 'state': 'NM', 'county': '045', 'huc_cd': '14080104'},
        {'site_no': '09355500', 'station_nm': 'ANIMAS RIVER AT DURANGO, CO', 
         'lat': 37.2756, 'lon': -107.8803, 'state': 'CO', 'county': '067', 'huc_cd': '14080104'}
    ]
    
    df = pd.DataFrame(sample_sites)
    df['parameter_cd'] = '00060'
    df['parameter_name'] = 'Streamflow, cubic feet per second'  
    df['unit'] = 'cfs'
    
    print(f"📝 Created sample dataset with {len(df)} sites")
    return df

def test_usgs_api():
    """Test USGS API connection"""
    import requests
    
    print("🌐 Testing USGS API...")
    
    try:
        url = "https://waterservices.usgs.gov/nwis/site/"
        params = {
            'format': 'rdb',
            'bBox': '-109.0,36.5,-108.0,37.0',  # Small test area
            'siteType': 'ST',
            'siteStatus': 'active'
        }
        
        response = requests.get(url, params=params, timeout=10)
        print(f"📡 API Status: {response.status_code}")
        
        if response.status_code == 200:
            lines = response.text.strip().split('\n')[:10]  # First 10 lines
            print("📄 Sample response:")
            for line in lines:
                print(f"  {line}")
            return True
        else:
            print(f"❌ API returned status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ API test failed: {e}")
        return False

def main():
    """Main debugging function"""
    print("🔍 Colorado Plateau Water Analysis - Debug Mode")
    print("=" * 50)
    
    # Test environment
    print(f"🐍 Python: {sys.version}")
    print(f"📍 Python executable: {sys.executable}")
    print(f"💻 Working directory: {os.getcwd()}")
    
    # Test imports
    if not test_imports():
        print("❌ Import test failed!")
        return
    
    # Test API
    api_works = test_usgs_api()
    
    # Create data
    print("\n📊 Creating sample data...")
    usgs_sites = create_sample_data()
    
    # Basic analysis
    print("\n📈 Basic Analysis:")
    print(f"  Total sites: {len(usgs_sites)}")
    print(f"  States: {usgs_sites['state'].unique()}")
    print(f"  Sample site: {usgs_sites.iloc[0]['station_nm']}")
    
    # Priority parameters
    PRIORITY_PARAMETERS = {
        '00060': 'Streamflow (Discharge), cubic feet per second',
        '00065': 'Gage height, feet', 
        '00010': 'Water temperature, degrees Celsius',
        '00095': 'Specific conductance, microsiemens per centimeter',
        '00300': 'Dissolved oxygen, milligrams per liter',
        '00400': 'pH, standard units',
        '00480': 'Salinity, parts per thousand'
    }
    
    print("\n🎯 Priority Parameters:")
    for code, desc in PRIORITY_PARAMETERS.items():
        print(f"  {code}: {desc}")
    
    # Filter to priority parameters (all our sample data is streamflow)
    priority_sites = usgs_sites[usgs_sites['parameter_cd'].isin(PRIORITY_PARAMETERS.keys())].copy()
    print(f"\n✅ Sites with priority parameters: {len(priority_sites)}")
    
    print("\n🎉 Debug test completed successfully!")
    print("🔄 You can now copy working code back to the notebook")

if __name__ == "__main__":
    main() 