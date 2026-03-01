import { useState } from 'react';
import { ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import { getMortgageRange, formatCurrency, calculateMortgage } from '../../utils/mortgageCalculator';

type MortgageEstimateProps = {
  propertyPrice: number;
  compact?: boolean;
};

export function MortgageEstimate({ propertyPrice, compact = false }: MortgageEstimateProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedRate, setSelectedRate] = useState(5.0);
  const estimates = getMortgageRange(propertyPrice);
  const selectedEstimate = calculateMortgage(propertyPrice, 20, selectedRate, 30);

  if (compact) {
    return (
      <div className="text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <DollarSign size={14} />
          <span>Propriestimated {formatCurrency(estimates.rate5.monthlyPayment)}/mo at 5% APR</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">
            Propriestimated Monthly Payment
          </h3>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(selectedEstimate.monthlyPayment)}/mo
          </p>
          <p className="text-xs text-gray-600 mt-1">
            At {selectedRate.toFixed(1)}% interest rate
          </p>
        </div>
        {showDetails ? (
          <ChevronUp size={20} className="text-gray-600" />
        ) : (
          <ChevronDown size={20} className="text-gray-600" />
        )}
      </button>

      {showDetails && (
        <div className="mt-4 pt-4 border-t border-blue-200 space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-2">
              Interest Rate Range
            </h4>
            <div className="grid grid-cols-5 gap-2 text-center">
              <button
                onClick={() => setSelectedRate(4.0)}
                className={`rounded-md p-2 transition ${
                  selectedRate === 4.0
                    ? 'bg-blue-100 ring-2 ring-blue-600'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                <p className="text-xs text-gray-600 mb-1">4.0% APR</p>
                <p className={`font-semibold ${
                  selectedRate === 4.0 ? 'text-blue-700' : 'text-gray-800'
                }`}>
                  {formatCurrency(estimates.rate4.monthlyPayment)}
                </p>
              </button>
              <button
                onClick={() => setSelectedRate(5.0)}
                className={`rounded-md p-2 transition ${
                  selectedRate === 5.0
                    ? 'bg-blue-100 ring-2 ring-blue-600'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                <p className="text-xs text-gray-600 mb-1">5.0% APR</p>
                <p className={`font-semibold ${
                  selectedRate === 5.0 ? 'text-blue-700' : 'text-gray-800'
                }`}>
                  {formatCurrency(estimates.rate5.monthlyPayment)}
                </p>
              </button>
              <button
                onClick={() => setSelectedRate(6.0)}
                className={`rounded-md p-2 transition ${
                  selectedRate === 6.0
                    ? 'bg-blue-100 ring-2 ring-blue-600'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                <p className="text-xs text-gray-600 mb-1">6.0% APR</p>
                <p className={`font-semibold ${
                  selectedRate === 6.0 ? 'text-blue-700' : 'text-gray-800'
                }`}>
                  {formatCurrency(estimates.low.monthlyPayment)}
                </p>
              </button>
              <button
                onClick={() => setSelectedRate(7.0)}
                className={`rounded-md p-2 transition ${
                  selectedRate === 7.0
                    ? 'bg-blue-100 ring-2 ring-blue-600'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                <p className="text-xs text-gray-600 mb-1">7.0% APR</p>
                <p className={`font-semibold ${
                  selectedRate === 7.0 ? 'text-blue-700' : 'text-gray-800'
                }`}>
                  {formatCurrency(estimates.mid.monthlyPayment)}
                </p>
              </button>
              <button
                onClick={() => setSelectedRate(8.0)}
                className={`rounded-md p-2 transition ${
                  selectedRate === 8.0
                    ? 'bg-blue-100 ring-2 ring-blue-600'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                <p className="text-xs text-gray-600 mb-1">8.0% APR</p>
                <p className={`font-semibold ${
                  selectedRate === 8.0 ? 'text-blue-700' : 'text-gray-800'
                }`}>
                  {formatCurrency(estimates.high.monthlyPayment)}
                </p>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-md p-3 text-xs space-y-2">
            <h4 className="font-semibold text-gray-800 mb-2">
              Payment Breakdown ({selectedRate.toFixed(1)}% APR)
            </h4>
            <div className="flex justify-between">
              <span className="text-gray-600">Principal & Interest</span>
              <span className="font-medium text-gray-800">
                {formatCurrency(selectedEstimate.principalAndInterest)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Property Tax</span>
              <span className="font-medium text-gray-800">
                {formatCurrency(selectedEstimate.propertyTax)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Home Insurance</span>
              <span className="font-medium text-gray-800">
                {formatCurrency(selectedEstimate.homeInsurance)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="font-semibold text-gray-800">Total Monthly</span>
              <span className="font-bold text-blue-600">
                {formatCurrency(selectedEstimate.monthlyPayment)}
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Based on 20% down payment, 30-year fixed rate mortgage. Actual rates and payments may vary. Property tax propriestimated at 1.2% annually, home insurance at 0.35% annually.
          </p>
        </div>
      )}
    </div>
  );
}
