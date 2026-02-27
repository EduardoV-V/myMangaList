import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "./supabase.js";

export default function Admin() {
  const [isAdmin, setIsAdmin] = useState(null);
  const [pending, setPending] = useState([]);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      setIsAdmin(false);
      return;
    }

    const { data: role } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (role) {
      setIsAdmin(true);
      fetchPending();
    } else {
      setIsAdmin(false);
    }
  };

  const fetchPending = async () => {
    const { data } = await supabase
      .from("pending_collections")
      .select("*");

    setPending(data || []);
  };

  const approveCollection = async (col) => {
    // inserir na collections oficial
    await supabase.from("collections").insert({
      title: col.title,
      cover_url: col.cover_url,
      type: col.type,
      cover_price: col.cover_price
    });

    // remover da pendente
    await supabase
      .from("pending_collections")
      .delete()
      .eq("id", col.id);

    fetchPending();
  };

  if (isAdmin === null) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-10">
      <h1 className="text-3xl mb-6">Painel Admin</h1>

      {pending.map((col) => (
        <div key={col.id} className="bg-gray-800 p-4 mb-4 rounded">
          <h2 className="text-xl">{col.title}</h2>
          <button
            onClick={() => approveCollection(col)}
            className="bg-green-600 px-4 py-2 mt-2 rounded"
          >
            Aprovar
          </button>
        </div>
      ))}
    </div>
  );
}