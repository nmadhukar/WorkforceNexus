#!/bin/bash

# Script to run Vitest with coverage reporting
# This script enables comprehensive code coverage tracking with 85% thresholds

echo "Running Vitest with coverage reporting..."
echo "Coverage reports will be generated in test-results/coverage/"
echo ""

# Run vitest with coverage enabled
npx vitest run --coverage

# Check the exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Coverage tests completed successfully!"
    echo ""
    echo "Coverage reports generated in:"
    echo "  - HTML Report: test-results/coverage/index.html"
    echo "  - LCOV Report: test-results/coverage/lcov.info"
    echo "  - JSON Report: test-results/coverage/coverage-final.json"
    echo ""
    echo "To view the HTML report, open: test-results/coverage/index.html in your browser"
else
    echo ""
    echo "✗ Coverage tests failed or coverage thresholds not met"
    echo "  Required thresholds: 85% for branches, functions, lines, and statements"
    exit 1
fi