import React from "react";
import { motion } from "framer-motion";

export default function LoadingScreen({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="mb-4"
        >
          <img 
            src="https://attlcrcpybgfkygcgwvz.supabase.co/storage/v1/object/public/driver-assets/logo-alt.png"
            alt="Logo"
            className="w-32 h-32 mx-auto object-contain"
          />
        </motion.div>
        {message && (
          <motion.p 
            className="text-slate-400 text-sm mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {message}
          </motion.p>
        )}
      </div>
    </div>
  );
}