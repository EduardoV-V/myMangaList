import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getUser();
  }, []);

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) navigate("/");
    setUser(user);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center px-4">
      <div className="bg-gray-800 p-8 rounded-xl shadow-xl border border-gray-700 w-full max-w-md text-center">

        <h1 className="text-2xl font-bold mb-6 text-blue-400">
          Meu Perfil
        </h1>

        {user && (
          <>
            <p className="mb-6 text-gray-300">
              {user.email}
            </p>

            <button
              onClick={logout}
              className="bg-red-600 px-5 py-2 rounded-lg hover:bg-red-500 transition"
            >
              Logout
            </button>
          </>
        )}

      </div>
    </div>
  );
}