#!/bin/bash

# 🌊 Water Watcher Data Exploration Environment Setup
echo "🌊 Setting up Water Watcher data exploration environment..."

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | grep -o '[0-9]\+\.[0-9]\+')
echo "📍 Detected Python version: $PYTHON_VERSION"

# Method 1: Try with updated requirements (Python 3.13 compatible)
echo "🔧 Method 1: Installing with pip (Python 3.13 compatible versions)..."
if pip install -r requirements.txt; then
    echo "✅ Successfully installed requirements with pip!"
    exit 0
fi

echo "⚠️  Pip installation failed. Trying alternative methods..."

# Method 2: Install core packages only
echo "🔧 Method 2: Installing core packages individually..."
pip install jupyter pandas numpy matplotlib seaborn requests plotly folium

# Method 3: Alternative for macOS with conda
if command -v conda &> /dev/null; then
    echo "🔧 Method 3: Conda detected. Installing with conda..."
    conda install -c conda-forge jupyter pandas geopandas folium matplotlib seaborn plotly requests numpy
else
    echo "💡 For best results on macOS, consider installing conda/mamba:"
    echo "   brew install miniconda"
    echo "   Then run: conda install -c conda-forge jupyter pandas geopandas folium matplotlib seaborn plotly"
fi

# Method 4: Docker alternative
cat << EOF

🐳 Alternative: Use Docker for consistent environment
If you continue having issues, you can use Docker:

1. Create Dockerfile:
   FROM jupyter/scipy-notebook:latest
   RUN conda install -c conda-forge geopandas folium plotly

2. Run: docker build -t water-watcher-analysis .
3. Run: docker run -p 8888:8888 -v \$(pwd):/home/jovyan/work water-watcher-analysis

EOF

echo "🎯 Environment setup complete! Try running: jupyter lab" 