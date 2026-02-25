import React from 'react';
import { ProductContribution } from '../../types';

interface ProductStackedBarProps {
    products: ProductContribution[];
    showLabels?: boolean;
    height?: number;
}

/**
 * ProductStackedBar - Horizontal bar showing product contribution
 * Each segment is colored and sized by percentage
 */
export const ProductStackedBar: React.FC<ProductStackedBarProps> = ({
    products,
    showLabels = true,
    height = 24
}) => {
    if (products.length === 0) return null;

    return (
        <div className="space-y-1">
            {/* Stacked Bar */}
            <div
                className="w-full rounded-full overflow-hidden flex"
                style={{ height }}
            >
                {products.map((product, idx) => (
                    <div
                        key={product.productPath}
                        className="h-full transition-all hover:opacity-80"
                        style={{
                            width: `${product.percentageOfTotal}%`,
                            backgroundColor: product.color,
                            minWidth: product.percentageOfTotal > 0 ? '4px' : '0'
                        }}
                        title={`${product.productName}: ${product.percentageOfTotal.toFixed(0)}% (${product.timeContribution.toFixed(1)}s)`}
                    />
                ))}
            </div>

            {/* Labels */}
            {showLabels && (
                <div className="flex flex-wrap gap-3 text-xs">
                    {products.map((product) => (
                        <div key={product.productPath} className="flex items-center gap-1">
                            <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: product.color }}
                            />
                            <span className="font-medium text-slate-600">
                                {product.productName}
                            </span>
                            <span className="text-slate-400">
                                {product.percentageOfTotal.toFixed(0)}%
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
