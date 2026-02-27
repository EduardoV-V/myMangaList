import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { useNavigate, Outlet, Link } from "react-router-dom";
import { FaUser } from "react-icons/fa";

export default function Layout() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

 return (
  <div className="min-h-screen bg-gray-900 text-gray-100">
    
    {/* Barra superior invisível apenas para alinhamento */}
    {user && (
      <div className="w-full flex justify-center pt-4 px-4">
        <div className="max-w-7xl w-full flex justify-end">
          <Link
            to="/profile"
            className="bg-gray-800 hover:bg-gray-700 text-gray-100 p-3 rounded-full border border-gray-600 shadow-md transition"
          >
            <FaUser />
          </Link>
        </div>
      </div>
    )}

    <Outlet />
  </div>
  );
}