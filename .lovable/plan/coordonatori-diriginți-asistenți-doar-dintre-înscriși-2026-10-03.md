# Coordonatori diriginți + asistenți doar dintre înscriși

## Cauza (verificată)
- Lista de coordonatori din pagina evenimentului cere deja rolurile profesor, coordonator și diriginte.
- Regula de acces „Teachers read teacher profiles" permite însă unui profesor să vadă numele doar pentru `teacher` și `coordinator_teacher`, nu și pentru `homeroom_teacher`. De aceea diriginții (care au doar rolul de diriginte) nu apar în listă pentru profesori. Diriginții îi văd, pentru că regula lor îi include.

## Ce se schimbă pentru utilizatori
1. Profesorii (și CSE) văd și pot alege diriginții ca coordonatori la evenimentele lor.
2. La „Adaugă asistent", lista arată doar elevii înscriși la eveniment (rezervare activă), cu clasa lor, nu toată școala. Se aplică în pagina profesorului și în cea de admin. Un elev deja asistent nu mai apare în listă. Dacă nu există înscriși, apare mesajul „Niciun elev înscris la acest eveniment".

## Detalii tehnice
- Migrare: înlocuiește politica `Teachers read teacher profiles` pe `profiles` ca să includă `homeroom_teacher` și `cse`; adaugă politica echivalentă pentru rolul `cse` (citire profile personal didactic). Doar id/nume sunt folosite în interfață.
- `ProfEventDetailPage.tsx` și `admin/EventDetailPage.tsx`: query-ul `all_students_for_*_assistant` se înlocuiește cu lista din `participants` (rezervări ne-anulate, deja încărcate), îmbogățită cu clasa din `student_class_assignments`; exclude elevii deja asistenți. Profilele participanților sunt deja vizibile organizatorului/coordonatorilor prin regulile existente.
- Validare server: trigger pe `event_student_assistants` care refuză inserarea dacă elevul nu are rezervare activă la eveniment („Elevul trebuie să fie înscris la eveniment ca să fie asistent").
- Verificare: build, interogare că un profesor vede profilele diriginților, test că inserarea unui asistent neînscris e refuzată.
