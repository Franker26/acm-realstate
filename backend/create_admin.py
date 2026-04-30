#!/usr/bin/env python3
"""Create a user in the database. Use --superadmin to create a platform superadmin."""
import os
import sys
import bcrypt as _bcrypt

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
except ImportError:
    pass

from models import Base, Company, SessionLocal, User, engine

Base.metadata.create_all(bind=engine)

is_superadmin = '--superadmin' in sys.argv

username = os.getenv("ADMIN_USERNAME") or input("Username: ")
password = os.getenv("ADMIN_PASSWORD") or input("Password: ")

hashed = _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()

with SessionLocal() as db:
    if db.query(User).filter(User.username == username).first():
        print(f"User '{username}' already exists.")
        sys.exit(0)

    company_id = None
    if not is_superadmin:
        # Assign to first company (or create Default)
        company = db.query(Company).order_by(Company.id).first()
        if not company:
            company = Company(name="Default")
            db.add(company)
            db.commit()
            db.refresh(company)
        company_id = company.id

    db.add(User(
        username=username,
        hashed_password=hashed,
        is_admin=not is_superadmin,
        is_approver=not is_superadmin,
        is_superadmin=is_superadmin,
        company_id=company_id,
    ))
    db.commit()

    role = "Superadmin" if is_superadmin else "Admin"
    print(f"{role} user '{username}' created.")
