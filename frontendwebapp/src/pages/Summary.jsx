import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getBankData } from "../api/bankApi";
import { getShareData } from "../api/shareApi";
import BarChart from "../components/BarChart";
import StatGrid from "../components/StatGrid";

const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function Summary() {
  const navigate = useNavigate();
  const [bankData, setBankData] = useState(null);
  const [shareData, setShareData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [graphTs, setGraphTs] = useState(() => Date.now());
  const [graphError, setGraphError] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getBankData(), getShareData()])
      .then(([bankResponse, shareResponse]) => {
        if (active) {
          setBankData(bankResponse);
          setShareData(shareResponse);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Unable to load summary data.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const bankSummary = bankData?.summary || {
    total_income: 0,
    total_expenses: 0,
    net_balance: 0,
  };
  const shareSummary = shareData?.summary || {
    overall_investment: 0,
    overall_profit_loss: 0,
  };

  const bankRecords = bankData?.records || [];
  const shareRecords = shareData?.records || [];
  const totalRecords = bankRecords.length + shareRecords.length;
  const hasEnoughData = totalRecords >= 10;

  const overallNet =
    Number(bankSummary.total_income || 0) -
    Number(bankSummary.total_expenses || 0) -
    Number(shareSummary.overall_investment || 0) +
    Number(shareSummary.overall_profit_loss || 0);

  const stats = [
    { label: "Total bank income", value: formatter.format(bankSummary.total_income || 0) },
    { label: "Total bank expenses", value: formatter.format(bankSummary.total_expenses || 0) },
    { label: "Total share investment", value: formatter.format(shareSummary.overall_investment || 0) },
    { label: "Total share profit/loss", value: formatter.format(shareSummary.overall_profit_loss || 0) },
    { label: "Overall net position", value: formatter.format(overallNet) },
  ];

  const chartData = [
    { label: "Bank expenses", value: Number(bankSummary.total_expenses || 0) },
    { label: "Share investment", value: Number(shareSummary.overall_investment || 0) },
    { label: "Share profit", value: Number(shareSummary.overall_profit_loss || 0) },
  ];

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Overall Summary</p>
          <h1>Combined view</h1>
        </div>
        <div className="header-actions">
          <button className="ghost" type="button" onClick={() => navigate(-1)}>
            Back
          </button>
          <Link className="ghost" to="/">
            Home
          </Link>
        </div>
      </header>

      {loading ? <p>Loading summary...</p> : null}
      {error ? <pre className="error-pre">{error}</pre> : null}

      {!loading && !error ? (
        <>
          {!hasEnoughData ? (
            <section className="card">
              <h3>Overall Summary</h3>
              <p className="subtitle">Add more transaction data to generate meaningful financial insights.</p>
            </section>
          ) : (
            <>
              <StatGrid items={stats} />
              <BarChart title="Expenses vs investment vs profit" data={chartData} />

              <section className="card">
                <div className="page-header" style={{ marginBottom: 12 }}>
                  <div>
                    <h3>Overall Summary</h3>
                    <p className="subtitle">Graphs update automatically when you refresh.</p>
                    {graphError ? (
                      <p className="subtitle" style={{ color: "#b91c1c" }}>
                        Unable to load summary charts. Please refresh.
                      </p>
                    ) : null}
                  </div>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => {
                      setGraphError(false);
                      setGraphTs(Date.now());
                    }}
                  >
                    Refresh graphs
                  </button>
                </div>

                <div className="graph-grid">
                  <div className="graph-card">
                    <h4>Monthly Overview</h4>
                    <img
                      className="graph-img"
                      src={`${API_BASE}/summary/graphs/monthly?ts=${graphTs}`}
                      alt="Monthly financial overview graph"
                      onError={() => setGraphError(true)}
                    />
                  </div>

                  <div className="graph-card">
                    <h4>Yearly Overview</h4>
                    <img
                      className="graph-img"
                      src={`${API_BASE}/summary/graphs/yearly?ts=${graphTs}`}
                      alt="Yearly financial overview graph"
                      onError={() => setGraphError(true)}
                    />
                  </div>

                  <div className="graph-card graph-span">
                    <h4>Combined Financial Overview</h4>
                    <img
                      className="graph-img"
                      src={`${API_BASE}/summary/graphs/combined?ts=${graphTs}`}
                      alt="Combined financial overview graph"
                      onError={() => setGraphError(true)}
                    />
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      ) : null}
    </main>
  );
}

export default Summary;
