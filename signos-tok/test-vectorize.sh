#!/bin/bash
echo "🔍 Verificando estado de Vectorize..."
cd worker
npx wrangler vectorize get signos-lsch-index 2>&1 | grep -E "(Dimensions|Vectors|Index)"
