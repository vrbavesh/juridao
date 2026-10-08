import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header.jsx";
import Banner from "./components/Banner.jsx";
import Toast from "./components/Toast.jsx";
import Landing from "./pages/Landing.jsx";
import Guide from "./pages/Guide.jsx";
import Notifications from "./pages/Notifications.jsx";
import Deals from "./pages/Deals.jsx";
import NewDeal from "./pages/NewDeal.jsx";
import DealDetail from "./pages/DealDetail.jsx";
import DisputeDetail from "./pages/DisputeDetail.jsx";
import Juror from "./pages/Juror.jsx";
import Courts from "./pages/Courts.jsx";
import MyCases from "./pages/MyCases.jsx";
import CaseJuror from "./pages/CaseJuror.jsx";
import Rewards from "./pages/Rewards.jsx";
import Admin from "./pages/Admin.jsx";
import TestLab from "./pages/TestLab.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Banner />
      <Header />
      <main className="min-h-screen">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/deals/new" element={<NewDeal />} />
          <Route path="/deals/:id" element={<DealDetail />} />
          <Route path="/disputes/:id" element={<DisputeDetail />} />
          <Route path="/juror" element={<Juror />} />
          <Route path="/courts" element={<Courts />} />
          <Route path="/cases" element={<MyCases />} />
          <Route path="/cases/:id" element={<CaseJuror />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/testlab" element={<TestLab />} />
        </Routes>
      </main>
      <Toast />
    </BrowserRouter>
  );
}
