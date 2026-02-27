import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Se não tem usuário, redireciona imediatamente
        navigate("/login", { replace: true });
        return;
      }
      setUser(user);
    } catch (error) {
      console.error("Erro ao verificar usuário:", error);
      navigate("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      // Força um pequeno delay para garantir que o signOut completou
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 100);
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Nunca deve chegar aqui por causa do redirecionamento
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center px-4">
      <div className="bg-gray-800 p-8 rounded-xl shadow-xl border border-gray-700 w-full max-w-md text-center">

        <h1 className="text-2xl font-bold mb-6 text-blue-400">
          Meu Perfil
        </h1>

        <p className="mb-6 text-gray-300">
          {user.email}
        </p>

        <button
          onClick={logout}
          disabled={loading}
          className={`bg-red-600 px-5 py-2 rounded-lg hover:bg-red-500 transition ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Saindo...' : 'Logout'}
        </button>

      </div>
    </div>
  );
}